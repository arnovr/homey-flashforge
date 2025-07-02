import { FlashForgeClient } from 'ff-5mp-api-ts';
import Homey from 'homey';

module.exports = class FlashForgeDevice extends Homey.Device {
  client: FlashForgeClient | undefined;
  pollInterval: NodeJS.Timeout | undefined;

  async onInit() {
    this.log('Initialize device');
    this.setCapabilityValue('onoff', false);
    const ip = this.getData().ip || this.getSetting('ip');
    this.client = new FlashForgeClient(ip);
    // Initialisation update
    await this.updateStatus()
    this.registerCapabilityListener("onoff", this.handleButton.bind(this));
    this.pollInterval = this.homey.setInterval(() => {
      this.updateStatus();
    }, 30000);
  }

  handleButton = async (value: boolean) => {
    if (!this.client) {
      throw new Error("Er is geen client geïnitialiseerd.");
    }

    await this.client.initControl();

    try {
      const printStatus = await this.client.getPrintStatus();
      const printPercent = printStatus?.getPrintPercent();

      const isPrinting = typeof printPercent === 'number' && !isNaN(printPercent);

      if (isPrinting) {
        if(printPercent != 100) { // It keeps a bit on 100%, Cant pause it on 100%
          if (value) {
            await this.client.resumeJob();
          } else {
            await this.client.pauseJob();
          }
          await this.setCapabilityValue("onoff", value);
        }
        return;
      }

      // Geen print bezig, dus blokkeren
      if (value) {
        throw new Error("Kan geen print hervatten als er geen print bezig is.");
      } else {
        throw new Error("Kan geen print pauzeren als er geen print bezig is.");
      }
    } finally {
      // Stop altijd de keepalive, ongeacht succes of fout
      await this.client.stopKeepAlive(true);
    }
  }

  async updateStatus() {
    if (!this.client) {
      return;
    }
    try {
      // Initialize control connection first
      await this.client.initControl();

      const temp = await this.client.getTempInfo();
      const printStatus = await this.client.getPrintStatus();

      const value = printStatus?.getPrintPercent();
      const bedTemp = temp?.getBedTemp()?.getCurrent() ?? 100; // 100 by default otherwise it might show that print is stopped.

      if (typeof value === 'number' && !isNaN(value)) { 
        this.log("Currently printing: " + value + "%");
        this.setCapabilityValue("measure_print_percentage", value)
        this.setCapabilityValue("onoff", true)


        if(value == 100 && bedTemp < 40) { 
          this.log("Cooldown period over, printing is officially done.");
          this.setCapabilityValue("measure_print_percentage", 0)
          this.setCapabilityValue("onoff", false)
        }

      }
      else {
        this.log("No print job found, disable and set percentage to 0");
        this.setCapabilityValue("measure_print_percentage", 0)
        this.setCapabilityValue("onoff", false)
      }

      if (temp) {
        this.log("Set extruder temperature: " + temp?.getExtruderTemp()?.getCurrent());
        this.setCapabilityValue('measure_temperature_extruder', temp?.getExtruderTemp()?.getCurrent());
        this.log("Set bed temperature: " + temp?.getBedTemp()?.getCurrent());
        this.setCapabilityValue('measure_temperature_bed', temp?.getBedTemp()?.getCurrent());
      }


      await this.client.stopKeepAlive(true)
    } catch (error) {
      this.log("Error found, turn off and reset ( could be powered off printer )");
      this.setCapabilityValue("measure_print_percentage", 0)
      this.setCapabilityValue('onoff', false);
    }
  }

  async onDeleted() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }


  async onUninit() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }
}