import { FlashForgeClient as GhostFlashForgeClient } from 'ff-5mp-api-ts';

export class FlashForgeClient {
  private client: GhostFlashForgeClient;

  constructor(ip: string) {
    this.client = new GhostFlashForgeClient(ip);
  }

  async getStatus(): Promise<FlashForgeStatus> {
    await this.client.initControl();

    const temp = await this.client.getTempInfo();
    const printStatus = await this.client.getPrintStatus();
    const printPercent = printStatus?.getPrintPercent() ?? 0;
    const bedTemp = temp?.getBedTemp()?.getCurrent() ?? 0;
    const extruderTemp = temp?.getExtruderTemp()?.getCurrent() ?? 0;

    await this.client.stopKeepAlive(true);

    return {
      isPrinting: typeof printPercent === 'number' && !isNaN(printPercent),
      printPercent,
      bedTemp,
      extruderTemp: extruderTemp,
      bedTempRaw: bedTemp,
    };
  }

  async pausePrint() {
    await this.client.initControl();
    await this.client.pauseJob();
    await this.client.stopKeepAlive(true);
  }

  async resumePrint() {
    await this.client.initControl();
    await this.client.resumeJob();
    await this.client.stopKeepAlive(true);
  }

  async isPrinting(): Promise<boolean> {
    await this.client.initControl();
    const printStatus = await this.client.getPrintStatus();
    await this.client.stopKeepAlive(true);

    const printPercent = printStatus?.getPrintPercent();
    return typeof printPercent === 'number' && !isNaN(printPercent) && printPercent !== 100;
  }

  async getPrinterName(): Promise<String> {
    await this.client.initControl()
    const x = await this.client.getPrinterInfo()
    await this.client.stopKeepAlive(true);
    return x?.TypeName ?? ""
  }
}

export interface FlashForgeStatus {
    isPrinting: boolean;
    printPercent: number;
    bedTemp: number;
    extruderTemp: number;
    bedTempRaw: number;
  }
  