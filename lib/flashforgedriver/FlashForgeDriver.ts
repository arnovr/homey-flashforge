import Homey from 'homey';
import { FlashForgePrinter, FlashForgePrinterDiscovery } from 'ff-5mp-api-ts';


export class FlashForgeDriver extends Homey.Driver {
    async onInit() {
      this.log('FlashForgeDriver has been initialized');
    }
  
    // async onPair(session: PairSession): Promise<void> {
    //   session.setHandler("validate_ip", async (ip: string) => {
    //     try {
    //       const client = new FlashForgeClient(ip);
    //       return client.getPrinterName();
    //     }
    //     catch {
    //       return "";
    //     }
    //   })
    // }
  
  
    async onPairListDevices() {
      const x = new FlashForgePrinterDiscovery();
      
      const printers = await x.discoverPrintersAsync() as FlashForgePrinter[]
      
      return printers.map(p => {
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
  };