import { FiveMClient } from "ff-5mp-api-ts";
import { NormalizedPrinterClient, FlashForgeStatus } from "./FlashForgeClient";

export class FiveMClientDecorator implements NormalizedPrinterClient {
    constructor(private client: FiveMClient) { }
    
    async connect(): Promise<boolean> {
      return await this.client.initialize()
    }

    async disconnect(): Promise<void> {
      await this.client.dispose();
    }
  
    async getStatus(): Promise<FlashForgeStatus> {
      const detailResponse = await this.client.info.getDetailResponse();
      const machineInfo = await this.client.info.get();


      return {
        isPrinting: await this.isPrinting(),
        printPercent: Math.round((detailResponse?.detail.printProgress ?? 0) * 100),
        bedTemp: machineInfo?.PrintBed.current ?? 0,
        extruderTemp: machineInfo?.Extruder.current ?? 0
      };
    }
  
    async pause() {
      return await this.client.jobControl.pausePrintJob();
    }
  
    async resume() {
      return await this.client.jobControl.resumePrintJob();
    }
    

    async isPrinting(): Promise<boolean> {
      return await this.client.info.isPrinting();
    }
  
    async getName(): Promise<string> {
      const response = await this.client.info.getDetailResponse()
      return response?.detail.name ?? ""
    }
  }