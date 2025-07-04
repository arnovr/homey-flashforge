import { FlashForgeClient } from "ff-5mp-api-ts";
import { FlashForgeStatus, NormalizedPrinterClient } from "./FlashForgeClient";

export class GhostFlashForgeClientDecorator implements NormalizedPrinterClient {
    constructor(private client: FlashForgeClient) { }
  
    async getStatus(): Promise<FlashForgeStatus> {
      const temp = await this.client.getTempInfo();
      const status = await this.client.getPrintStatus();
  
      const printPercent = status?.getPrintPercent?.() ?? 0;
      const bedTemp = temp?.getBedTemp?.()?.getCurrent?.() ?? 0;
      const extruderTemp = temp?.getExtruderTemp?.()?.getCurrent?.() ?? 0;
  
      return {
        isPrinting: typeof printPercent === 'number' && !isNaN(printPercent),
        printPercent,
        bedTemp,
        extruderTemp
      };
    }
  
    async pause() {
      return await this.client.pauseJob();
    }
  
    async resume() {
      return await this.client.resumeJob();
    }
  
    async isPrinting(): Promise<boolean> {
      const status = await this.client.getPrintStatus();
      const percent = status?.getPrintPercent?.();
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
  