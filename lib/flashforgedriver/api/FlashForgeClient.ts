import { FiveMClient, FlashForgeClient as GhostFlashForgeClient } from 'ff-5mp-api-ts';
import { FiveMClientDecorator } from './FiveMClientDecorator';
import { GhostFlashForgeClientDecorator } from './GhostFlashForgeClientDecorator';
import { ConsoleLogUtils } from '../../ConsoleLogUtils';

export class FlashForgeClient {
  private client: NormalizedPrinterClient;

  constructor(settings: PrinterSettings) {
    // checkCode is never filled with the adventurer 3 / 4, as we do not supply them.
    // Adventurer 3 4 always uses fallback client ( GhostFlashForgeClient )

    this.client = ConsoleLogUtils.withoutConsoleLogSync(() => {
      if (settings.checkCode && settings.checkCode.trim() !== '') {
        const fivem = new FiveMClient(settings.ipAddress, settings.serialNumber, settings.checkCode);
        return new FiveMClientDecorator(fivem);
      } else {
        const ghost = new GhostFlashForgeClient(settings.ipAddress);
        return new GhostFlashForgeClientDecorator(ghost);
      }
    });
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
    return ConsoleLogUtils.withoutConsoleLog(async () => {
      const connected = await this.client.connect();
      if(!connected) {
          throw new ConnectionFailedError()
      }
      try {
        return await fn();
      } finally {
        await this.client.disconnect();
      }
    });
  }
}

export class ConnectionFailedError extends Error {
  constructor(message = 'Connection to the printer failed.') {
    super(message);
    this.name = 'ConnectionFailedError';
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
