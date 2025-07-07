import Homey from 'homey';
import { ConnectionFailedError, FlashForgeClient, FlashForgeStatus, PrinterSettings } from './api/FlashForgeClient';

export class FlashForgeDevice extends Homey.Device {
  client: FlashForgeClient | undefined;
  pollInterval: NodeJS.Timeout | undefined;
  deviceName: String = "";


  async onInit() {
    this.log('Initialize device');
    this.setCapabilityValue('onoff', false);

    const settings = this.getSettings() as PrinterSettings
    const data = this.getData();

    this.client = new FlashForgeClient({
      ...settings,
      serialNumber: data["serialNumber"] ?? ""
    });

    await this.updateStatus();

    this.registerCapabilityListener("onoff", () => {
      this.log("On off is pressed")
    });

    this.registerCapabilityListener("is_printing", this.handleButton.bind(this));

    this.pollInterval = this.homey.setInterval(() => {
      this.updateStatus();
    }, 30000);
  }

  handleButton = async (value: boolean) => {
    if (!this.client) {
      throw new Error("Er is geen client geïnitialiseerd.");
    }
    this.log("Button is pressed")

    const isPrinting = await this.client.isPrinting();

    if (isPrinting) {
      if (value) {
        this.setStoreValue(STORE_KEYS.IS_PAUSED, false)
        await this.client.resume();
      } else {
        this.setStoreValue(STORE_KEYS.IS_PAUSED, true)
        await this.client.pause();
      }
      await this.setCapabilityValue("is_printing", value);
    } else {
      throw new Error(value
        ? "Kan geen print hervatten als er geen print bezig is."
        : "Kan geen print pauzeren als er geen print bezig is.");
    }
  }

  async updateStatus() {
    if (!this.client) return;

    try { 
      const status = await this.client.getStatus();
      this.online();
      this.setStoreValue(STORE_KEYS.IS_PRINTING, status.isPrinting)

      this.updateTemperatures(status)

      if (status.isPrinting) {
        this.setStoreValue(STORE_KEYS.IS_DELAYED_PRINTING, true)
        this.updateCapabilities(status.printPercent, true);
        return;
      }

      const isDelayedPrinting = this.getStoreValue(STORE_KEYS.IS_DELAYED_PRINTING);
      if (isDelayedPrinting) {
        if (this.isCooledDown(status.bedTemp) ) {
          await this.cooledDown()
          return;
        }

        // Printing officially done according to the printer, but keep at 100%
        this.updateCapabilities(100, false);
        return;
      }

    } catch (error: unknown) {
      this.handleError(error);
    } finally {
      await this.client.disconnect()
    }
  }
  
  handleError(error: unknown) {
    const connectionFailedRetry = (this.getStoreValue(STORE_KEYS.CONNECTION_FAILED_THRESHOLD) as number | undefined) ?? 0;

    if (error instanceof ConnectionFailedError) {
      if ( connectionFailedRetry > 2 ) {
        this.offline();
      }
      this.log("Connection failed: printer might be powered off, retry: " + connectionFailedRetry);
    } else {
      this.log("Unexpected error, turn off and reset (could be powered off printer), retry: " + connectionFailedRetry);
    }

    this.setStoreValue(STORE_KEYS.CONNECTION_FAILED_THRESHOLD, connectionFailedRetry + 1);
  }

  async cooledDown() {
    this.setStoreValue(STORE_KEYS.IS_DELAYED_PRINTING, false)
        
    const triggerCard = this.homey.flow.getDeviceTriggerCard("finished_printing_cooled_down_" + this.deviceName)
    triggerCard.trigger(this, {}, {})

    this.updateCapabilities(0, false);
  }

  updateTemperatures(status: FlashForgeStatus) {
    this.log("Temperatures: Bed: " + status.bedTemp + " , extruder: " + status.extruderTemp);

    this.setCapabilityValue(`measure_temperature.extruder`, status.extruderTemp);
    this.setCapabilityValue(`measure_temperature.bed`, status.bedTemp);
  }

  updateCapabilities(percentage: Number, isPrinting: boolean) {
    this.log("Update capabilities, print percentage: " + percentage + ", is printing: " + isPrinting)
    this.setCapabilityValue("measure_print_percentage", percentage);
    this.setCapabilityValue("is_printing", isPrinting);
  }

  offline() {
    this.log("Printer offline")

    this.updateCapabilities(0, false);
    this.setStoreValue(STORE_KEYS.CONNECTION_FAILED_THRESHOLD, 0);
    this.setCapabilityValue("onoff", false);
  }
  online() { 
    this.setStoreValue(STORE_KEYS.CONNECTION_FAILED_THRESHOLD, 0);
    this.log("Printer online")
    this.setCapabilityValue("onoff", true);
  }

  isCooledDown(bedTemperature: number) {
    return bedTemperature < 40
  }


  async onDeleted() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  async onUninit() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }
}


export enum STORE_KEYS {
  IS_PAUSED = "IS_PRINTING_PAUSE",
  IS_PRINTING = "IS_PRINTING",
  IS_DELAYED_PRINTING = "IS_DELAYED_PRINTING",
  CONNECTION_FAILED_THRESHOLD  = "CONNECTION_FAILED_THRESHOLD"
}
