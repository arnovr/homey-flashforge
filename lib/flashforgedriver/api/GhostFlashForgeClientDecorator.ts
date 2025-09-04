import { FlashForgeClient, PrintStatus } from "ff-5mp-api-ts";
import { FlashForgeStatus, NormalizedPrinterClient } from "./FlashForgeClient";

export class GhostFlashForgeClientDecorator implements NormalizedPrinterClient {
    constructor(private client: FlashForgeClient) { }
  
    async getStatus(): Promise<FlashForgeStatus> {
      const temp = await this.client.getTempInfo();
      const status = await this.client.getPrintStatus();
  
      let printPercent = 0;
      if(status) {
        printPercent = this.getPrintPercent(status);
      }

      const bedTemp = temp?.getBedTemp?.()?.getCurrent?.() ?? 0;
      const extruderTemp = temp?.getExtruderTemp?.()?.getCurrent?.() ?? 0;
  
      return {
        isPrinting: printPercent > 0,
        printPercent: printPercent,
        bedTemp,
        extruderTemp
      };
    }

    private getPrintPercent(status: PrintStatus): number {
      // The format is "current/total"
      const [current, total] = status.getSdProgress().split("/");
      return parseInt(current) / parseInt(total) * 100;
    }
  
    async pause() {
      return await this.client.pauseJob();
    }
  
    async resume() {
      return await this.client.resumeJob();
    }
  
    async isPrinting(): Promise<boolean> {
      const status = await this.client.getPrintStatus();
      if(!status) return false;
      
      const percent = this.getPrintPercent(status);
      return typeof percent === 'number' && percent < 100;
    }
  
    async getPrinterName(): Promise<string> {
      const info = await this.client.getPrinterInfo();
      return info?.TypeName ?? '';
    }

    async connect(): Promise<boolean> {
      return await this.client.initControl()
    }
    async disconnect(): Promise<void> {
      await this.client.stopKeepAlive(true);
    }
  }
  