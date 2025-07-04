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
        printPercent: parseFloat(((detailResponse?.detail.printProgress ?? 0) * 100).toFixed(2)),
        bedTemp: parseFloat(((machineInfo?.PrintBed.current ?? 0)).toFixed(2)),
        extruderTemp: parseFloat(((machineInfo?.Extruder.current ?? 0)).toFixed(2)),
      };
    }
  
    async pause() {
      // This gives error, MOST likely because the connection is killed to fast.
      //{"serialNumber":"","checkCode":"","payload":{"cmd":"jobCtl_cmd","args":{"jobID":"","action":"pause"}}}
        // sendCommand: ~M602
        // CheckSocket()
        // Command reply: {"code":0,"message":"Success"}
        // Keep-alive stopped.
        // TcpPrinterClient closing socket
        // Keep-alive stopped.
        // ReceiveMultiLineReplayAsync timed out after 5000ms
        // /node_modules/ff-5mp-api-ts/dist/tcpapi/FlashForgeTcpClient.js:339
        //                 this.socket.removeListener('data', dataHandler);
        //                             ^

        // TypeError: Cannot read properties of null (reading 'removeListener')
        //     at cleanup (/node_modules/ff-5mp-api-ts/dist/tcpapi/FlashForgeTcpClient.js:339:29)

      return await this.client.jobControl.pausePrintJob();
    }
    
  
    async resume() {
      return await this.client.jobControl.resumePrintJob();
    }
    

    async isPrinting(): Promise<boolean> {
      return await this.client.info.isPrinting();
    }
  
    async getPrinterName(): Promise<string> {
      const response = await this.client.info.getDetailResponse()
      return response?.detail.name ?? ""
    }
  }