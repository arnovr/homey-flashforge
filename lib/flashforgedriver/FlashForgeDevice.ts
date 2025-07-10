import Homey from 'homey';
import { ConnectionFailedError, FlashForgeClient, FlashForgeStatus, PrinterSettings } from './api/FlashForgeClient';

export class FlashForgeDevice extends Homey.Device {
  client: FlashForgeClient | undefined;
  pollInterval: NodeJS.Timeout | undefined;
  deviceName: String = "";


  async onInit() {
    this.log('Initialize device');
    this.setCapabilityValue('is_online', false);
    this.setCapabilityValue('measure_print_percentage', 0);

    const settings = this.getSettings() as PrinterSettings
    const data = this.getData();

    this.client = new FlashForgeClient({
      ...settings,
      serialNumber: data["serialNumber"] ?? ""
    });

    await this.updateStatus();

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
        if(this.getStoreValue(STORE_KEYS.IS_PAUSED)) {
          this.resume()
        }
        else {
          this.log("Pressed button while not being in a previous paused state.")
        }
      } else {
        await this.pause()
      }
      await this.setCapabilityValue("is_printing", value);
    } else {
      throw new Error(value
        ? "Cannot resume print if no print is in progress."
        : "Cannot pause print if no print is in progress.");
    }
  }

  async updateStatus() {
    if (!this.client) return;

    try { 
      const status = await this.client.getStatus();
      this.online();
      this.updateTemperatures(status)
      
      if (status.isPrinting) {
        this.updatePrintingState(status.printPercent);
        return;
      }

      // When the device print state is officially finished
      // We track our internal state to finish cooldown period
      // And just update the percentage to 100% as that is not always fail proof in the api.
      if (this.isPrinting()) {
        if (this.isCooledDown(status.bedTemp) ) {
          await this.cooledDown()
          return;
        }

        this.printingIsFinished();
      }
    } catch (error: unknown) {
      this.handleError(error);
    } 
  }

  isPrinting(): boolean {
    return this.getStoreValue(STORE_KEYS.IS_PRINTING);
  }

  updatePrintingState(percentage: number) {
    this.setStoreValue(STORE_KEYS.IS_PRINTING, true)
    this.updateCapabilities(percentage, true);
  }

  printingIsFinished() {
      // Printing officially done according to the printer, but keep at 100%
      this.updateCapabilities(100, false);
  }
  
  handleError(error: unknown) {
    const connectionFailedRetry = (this.getStoreValue(STORE_KEYS.CONNECTION_FAILED_THRESHOLD) as number | undefined) ?? 0;

    if (error instanceof ConnectionFailedError) {
      this.log("Connection failed: printer might be powered off, retry: " + connectionFailedRetry);
    } else {
      this.log("Unexpected error, turn off and reset (could be powered off printer), retry: " + connectionFailedRetry);
    }

    this.setStoreValue(STORE_KEYS.CONNECTION_FAILED_THRESHOLD, connectionFailedRetry + 1);

    if ( connectionFailedRetry > 2 ) {
      this.offline();
    }
  }

  async cooledDown() {
    this.setStoreValue(STORE_KEYS.IS_PRINTING, false)

    this.trigger("finished_printing_cooled_down");

    this.updateCapabilities(0, false);
  }

  async pause() {
    if (!this.client) return;

    this.setStoreValue(STORE_KEYS.IS_PAUSED, true)
    this.trigger("printing_paused")
    return await this.client.pause();
  }
  async resume() {
    if (!this.client) return;

    this.setStoreValue(STORE_KEYS.IS_PAUSED, false)
    this.trigger("printing_resumed")
    return await this.client.resume();
  }

  updateTemperatures(status: FlashForgeStatus) {
    this.log("Temperatures: Bed: " + status.bedTemp + " , extruder: " + status.extruderTemp);

    this.setCapabilityValue(`measure_temperature.extruder`, status.extruderTemp);
    this.setCapabilityValue(`measure_temperature.bed`, status.bedTemp);
  }

  updateCapabilities(percentage: Number, isPrinting: boolean) {
    this.log("Print percentage: " + percentage + ", is printing: " + isPrinting)
    this.setCapabilityValue("measure_print_percentage", percentage);
    this.setCapabilityValue("is_printing", isPrinting);
  }

  offline() {
    this.updateCapabilities(0, false);
    this.setStoreValue(STORE_KEYS.CONNECTION_FAILED_THRESHOLD, 0);
    this.setCapabilityValue("is_online", false);
  }

  online() { 
    this.setStoreValue(STORE_KEYS.CONNECTION_FAILED_THRESHOLD, 0);
    this.setCapabilityValue("is_online", true);
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

  /**
   * Automatically appends the device name as _34
   * @param name String
   */
  trigger(name: String) {
    const triggerCard = this.homey.flow.getDeviceTriggerCard(name + "_" + this.deviceName)
    triggerCard.trigger(this, {}, {})
  }
}


export enum STORE_KEYS {
  IS_PAUSED = "IS_PAUSED",
  IS_PRINTING = "IS_PRINTING", // This is an internal state that does sync with the printer isPrinting. It's also used for cooled down mode.
  CONNECTION_FAILED_THRESHOLD  = "CONNECTION_FAILED_THRESHOLD"
}
