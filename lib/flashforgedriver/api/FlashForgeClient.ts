import { FiveMClient, FlashForgeClient as GhostFlashForgeClient } from 'ff-5mp-api-ts';
import { FiveMClientDecorator } from './FiveMClientDecorator';
import { GhostFlashForgeClientDecorator } from './GhostFlashForgeClientDecorator';

export class FlashForgeClient {
  private client: NormalizedPrinterClient;

  constructor(settings: PrinterSettings) {
    if (settings.checkCode && settings.checkCode.trim() !== '') {
      const fivem = new FiveMClient(settings.ipAddress, settings.serialNumber, settings.checkCode);
      this.client = new FiveMClientDecorator(fivem);
    } else { // Fall back to legacy for now
      const ghost = new GhostFlashForgeClient(settings.ipAddress);
      this.client = new GhostFlashForgeClientDecorator(ghost);
    }
  }

  getStatus(): Promise<FlashForgeStatus> {
    return this.withConnection(() => this.client.getStatus());
  }
  
  pausePrint(): Promise<boolean> {
    return this.withConnection(() => this.client.pause());
  }
  
  resumePrint(): Promise<boolean> {
    return this.withConnection(() => this.client.resume());
  }
  
  isPrinting(): Promise<boolean> {
    return this.withConnection(() => this.client.isPrinting());
  }
  
  getPrinterName(): Promise<string> {
    return this.withConnection(() => this.client.getName());
  }

  private async withConnection<T>(fn: () => Promise<T>): Promise<T> {
    // Pretty ugly, but the library spams the logging.
    const originalLog = console.log;
    console.log = () => {};
    try {
      await this.client.connect();
      return await fn();
    } finally {
      await this.client.disconnect();

      console.log = originalLog;
    }
  }
  
}


export type PrinterSettings = {
  ipAddress: string;
  checkCode: string;
  serialNumber: string;
};


export interface FlashForgeStatus {
  isPrinting: boolean;
  printPercent: number;
  bedTemp: number;
  extruderTemp: number;
}

export interface NormalizedPrinterClient {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  getStatus(): Promise<FlashForgeStatus>;
  pause(): Promise<boolean>;
  resume(): Promise<boolean>;
  isPrinting(): Promise<boolean>;
  getName(): Promise<string>;
}
