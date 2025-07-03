import Homey from 'homey';
import { FlashForgeClient, PrinterSettings } from './flashforge/FlashForgeClient';

module.exports = class FlashForgeDevice extends Homey.Device {
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
        await this.client.resumePrint();
      } else {
        await this.client.pausePrint();
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

      if (status.isPrinting) {
        this.log(`Currently printing: ${status.printPercent}%`);
        this.setCapabilityValue("measure_print_percentage", status.printPercent);
        this.setCapabilityValue("onoff", true);

        if (status.printPercent === 100 && status.bedTemp < 40) {
          this.log("Cooldown period over, printing is officially done.");
          this.setCapabilityValue("measure_print_percentage", 0);
          this.setCapabilityValue("onoff", false);
        }
      } else {
        this.log("No print job found, disable and set percentage to 0");
        this.setCapabilityValue("measure_print_percentage", 0);
        this.setCapabilityValue("onoff", false);
      }

      this.log("Temperatures: Bed: " + status.bedTemp + " , extruder: " + status.extruderTemp);
      this.setCapabilityValue("measure_temperature.extruder", status.extruderTemp);
      this.setCapabilityValue("measure_temperature.bed", status.bedTemp);
    } catch (error) {
      this.log("Error found, turn off and reset ( could be powered off printer )");
      this.setCapabilityValue("measure_print_percentage", 0);
      this.setCapabilityValue("onoff", false);
    }
  }

  async onDeleted() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  async onUninit() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }
}
