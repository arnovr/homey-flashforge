import Homey from 'homey';
import { PairSession } from 'homey/lib/Driver';
import { FlashForgeClient } from './api/FlashForgeClient';

export class FlashForgeManualDriver extends Homey.Driver {
    async onInit() {
      this.log('FlashForgeManualDriver has been initialized');
    }
  
    async onPair(session: PairSession): Promise<void> {
      session.setHandler("validate_ip", async (ip: string) => {
        try {
            const client = new FlashForgeClient({
              ipAddress: ip,
              serialNumber: "",
              checkCode: ""
            });
            const connected = await client.connect();
            if(connected) {
              await client.disconnect();
            }
            
            const printerName = await client.getPrinterName();
            return printerName;
        }
        catch {
          return "";
        }
      })
    }
  };