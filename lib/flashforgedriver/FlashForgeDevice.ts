import Homey from 'homey';
import { ConnectionFailedError, FlashForgeClient, FlashForgeStatus, PrinterSettings } from './api/FlashForgeClient';

export class FlashForgeDevice extends Homey.Device {
  client: FlashForgeClient | undefined;
  pollInterval: NodeJS.Timeout | undefined;

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

    this.registerCapabilityListener("onoff", this.handleButton.bind(this));

    this.pollInterval = this.homey.setInterval(() => {
      this.updateStatus();
    }, 30000);
  }

  handleButton = async (value: boolean) => {
    if (!this.client) {
      throw new Error("Er is geen client geïnitialiseerd.");
    }

    const isPrinting = await this.client.isPrinting();

    if (isPrinting) {
      if (value) {
        this.setStoreValue(STORE_KEYS.IS_PAUSED, false)
        await this.client.resume();
      } else {
        this.setStoreValue(STORE_KEYS.IS_PAUSED, true)
        await this.client.pause();
      }
      await this.setCapabilityValue("onoff", value);
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
          this.cooledDown()
          return;
        }

        // Printing officially done according to the printer, but keep at 100%
        this.updateCapabilities(100, false);
        return;
      }

    } catch (error: unknown) {
      this.handleError(error);
    }

    this.updateCapabilities(0, false);
  }
  
  handleError(error: unknown) {
    if (error instanceof ConnectionFailedError) {
      this.offline();
      this.log("Connection failed: printer might be powered off.");
    } else {
      this.log("Unexpected error, turn off and reset (could be powered off printer).");
    }
  }
  cooledDown() {
    this.setStoreValue(STORE_KEYS.IS_DELAYED_PRINTING, false)
        
    const cooledDownTrigger = this.homey.flow.getTriggerCard('finished_printing_cooled_down');
    cooledDownTrigger.trigger()
    this.updateCapabilities(0, false);
  }

  updateTemperatures(status: FlashForgeStatus) {
    this.log("Temperatures: Bed: " + status.bedTemp + " , extruder: " + status.extruderTemp);
    this.setCapabilityValue("measure_temperature.extruder", status.extruderTemp);
    this.setCapabilityValue("measure_temperature.bed", status.bedTemp);
  }

  updateCapabilities(percentage: Number, onoff: boolean) {
    this.log("Update capabilities, print percentage: " + percentage + ", device: " + onoff)
    this.setCapabilityValue("measure_print_percentage", percentage);
    this.setCapabilityValue("onoff", onoff);
  }

  offline() {
    this.log("Printer offline")
    // this.setCapabilityValue("alarm_generic", false)
  }
  online() { 
    this.log("Printer online")
    // this.setCapabilityValue("alarm_generic", true)
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
  IS_DELAYED_PRINTING = "IS_DELAYED_PRINTING"
}
