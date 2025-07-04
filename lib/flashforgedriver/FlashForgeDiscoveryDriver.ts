import Homey from 'homey';
import { FlashForgePrinter, FlashForgePrinterDiscovery } from 'ff-5mp-api-ts';


export class FlashForgeDiscoveryDriver extends Homey.Driver {
    async onInit() {
      this.log('FlashForgeDiscoveryDriver has been initialized');
    }
  
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