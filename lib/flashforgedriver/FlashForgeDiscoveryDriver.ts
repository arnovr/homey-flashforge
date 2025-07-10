import Homey from 'homey';
import { FlashForgePrinter, FlashForgePrinterDiscovery } from 'ff-5mp-api-ts';
import PairSession from 'homey/lib/PairSession';
import { FlashForgeClient } from './api/FlashForgeClient';


export class FlashForgeDiscoveryDriver extends Homey.Driver {
  private devicesToPair: FlashForgePrinter[] = [];

    async onInit() {
      this.log('FlashForgeDiscoveryDriver has been initialized');
    }
  

    async listDevices() {
      const flashForgeDiscovery = new FlashForgePrinterDiscovery();
      
      this.devicesToPair = await flashForgeDiscovery.discoverPrintersAsync() as FlashForgePrinter[]
      
      return this.devicesToPair;
    }

    async onPair(session: PairSession): Promise<void> {
      session.setHandler('list_devices', this.listDevices.bind(this));

      session.setHandler('saveDevice', async ({ checkCode }) => {
        if(this.devicesToPair.length == 0 ) {
          throw new Error('Printer not found.');
        }
        const printer = this.devicesToPair[0]; // should always be one, singular = true on driver.compose.json
        if (!printer) throw new Error('Printer not found.');

        const client = new FlashForgeClient({
          ipAddress: printer.ipAddress,
          serialNumber: printer.serialNumber,
          checkCode: checkCode
        });

        const connected = await client.connect();
        if(connected) {
          await client.disconnect();
        }
        else {
          throw new Error('Could not connect to printer, wrong checkcode?');
        }

        // Pass full data to the frontend so it could create the device
        session.emit("createDevice", {
          name: printer.name,
          data: { serialNumber: printer.serialNumber },
          settings: {
            ipAddress: printer.ipAddress,
            checkCode: checkCode,
          }
        }
      )
      });
    }
  };