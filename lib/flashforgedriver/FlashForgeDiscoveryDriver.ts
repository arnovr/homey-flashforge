import Homey from 'homey';
import { FlashForgePrinter, FlashForgePrinterDiscovery } from 'ff-5mp-api-ts';
import PairSession from 'homey/lib/PairSession';


export class FlashForgeDiscoveryDriver extends Homey.Driver {

  private devicesToPair: any[] = [];

    async onInit() {
      this.log('FlashForgeDiscoveryDriver has been initialized');
    }
  

    async listDevices() {
      const flashForgeDiscovery = new FlashForgePrinterDiscovery();
      
      this.devicesToPair = await flashForgeDiscovery.discoverPrintersAsync() as FlashForgePrinter[]
      
      return this.devicesToPair.map(p => {
        return {
          name: p.name,
          data: {
            serialNumber: p.serialNumber,
          },
          settings: {
            ipAddress: p.ipAddress,
            checkCode: ""
          }
        };
      });
    }

    async onPair(session: PairSession): Promise<void> {
      session.setHandler('list_devices', this.listDevices.bind(this));

      session.setHandler('saveDevice', async ({ checkCode }) => {
        const printer = this.devicesToPair.pop(); // should always be one, singular = true on driver.compose.json
        if (!printer) throw new Error('Printer not found.');

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