import Homey from 'homey';
import PairSession from 'homey/lib/PairSession';
import { FlashForgeClient } from 'ff-5mp-api-ts';

module.exports = class Adventurer5M extends Homey.Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('Adventurer5M has been initialized');
  }

  async onPair(session: PairSession): Promise<void> {
    session.setHandler("validate_ip", async (ip: string) => {
      try {
        const client = new FlashForgeClient(ip);
        await client.initControl()
        const x = await client.getPrinterInfo()
        await client.stopKeepAlive(true);
        return x?.TypeName ?? ""
      }
      catch {
        return "";
      }
    })
  }

  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    return [
    ];
  }
};
