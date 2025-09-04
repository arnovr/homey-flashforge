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
        isPrinting: this.checkIsPrinting(extruderTemp, printPercent),
        printPercent: printPercent,
        bedTemp,
        extruderTemp
      };
    }

    private checkIsPrinting(extruderTemp: number, printPercent: number): boolean {
      if(printPercent == 0 ) {
        return extruderTemp > 70;
      }
      return printPercent < 100;
    }

    private getPrintPercent(status: PrintStatus): number {
      // The format is "current/total"
      const [current, total] = status.getSdProgress().split("/");

      const c = parseInt(current, 10);
      const t = parseInt(total, 10);

      if (isNaN(c) || isNaN(t) || t === 0) return 0;

      return Math.round((c / t) * 100);
    }
  
    async pause() {
      return await this.client.pauseJob();
    }
  
    async resume() {
      return await this.client.resumeJob();
    }
  
    async isPrinting(): Promise<boolean> {
      const status = await this.getStatus();
      return status.isPrinting;
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
  