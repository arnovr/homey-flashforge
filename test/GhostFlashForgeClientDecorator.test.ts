import { GhostFlashForgeClientDecorator } from '../lib/flashforgedriver/api/GhostFlashForgeClientDecorator';
import { FlashForgeStatus } from '../lib/flashforgedriver/api/FlashForgeClient';

// Mock the ff-5mp-api-ts module
jest.mock('ff-5mp-api-ts', () => ({
  FlashForgeClient: jest.fn(),
}));

describe('GhostFlashForgeClientDecorator', () => {
  let decorator: GhostFlashForgeClientDecorator;
  let mockClient: any;

  beforeEach(() => {
    // Create mock client with all required methods from ff-5mp-api-ts FlashForgeClient
    mockClient = {
      getTempInfo: jest.fn(),
      getPrintStatus: jest.fn(),
      pauseJob: jest.fn(),
      resumeJob: jest.fn(),
      getPrinterInfo: jest.fn(),
      initControl: jest.fn(),
      stopKeepAlive: jest.fn(),
    };

    decorator = new GhostFlashForgeClientDecorator(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStatus', () => {
    it('should return status with print percent from client', async () => {
      const mockTempInfo = {
        getBedTemp: jest.fn().mockReturnValue({
          getCurrent: jest.fn().mockReturnValue(60)
        }),
        getExtruderTemp: jest.fn().mockReturnValue({
          getCurrent: jest.fn().mockReturnValue(210)
        })
      };

      const mockPrintStatus = {
        getSdProgress: jest.fn().mockReturnValue("75/100")
      };

      mockClient.getTempInfo.mockResolvedValue(mockTempInfo);
      mockClient.getPrintStatus.mockResolvedValue(mockPrintStatus);

      const result = await decorator.getStatus();

      expect(result).toEqual({
        isPrinting: true,
        printPercent: 75,
        bedTemp: 60,
        extruderTemp: 210
      });

      expect(mockClient.getTempInfo).toHaveBeenCalled();
      expect(mockClient.getPrintStatus).toHaveBeenCalled();
      expect(mockPrintStatus.getSdProgress).toHaveBeenCalled();
    });

    it('should handle missing print status gracefully', async () => {
      const mockTempInfo = {
        getBedTemp: jest.fn().mockReturnValue({
          getCurrent: jest.fn().mockReturnValue(25)
        }),
        getExtruderTemp: jest.fn().mockReturnValue({
          getCurrent: jest.fn().mockReturnValue(25)
        })
      };

      mockClient.getTempInfo.mockResolvedValue(mockTempInfo);
      mockClient.getPrintStatus.mockResolvedValue(null);

      const result = await decorator.getStatus();

      expect(result).toEqual({
        isPrinting: false,
        printPercent: 0,
        bedTemp: 25,
        extruderTemp: 25
      });
    });

    it('should handle missing temperature info gracefully', async () => {
      const mockPrintStatus = {
        getSdProgress: jest.fn().mockReturnValue("50/100")
      };

      mockClient.getTempInfo.mockResolvedValue(null);
      mockClient.getPrintStatus.mockResolvedValue(mockPrintStatus);

      const result = await decorator.getStatus();

      expect(result).toEqual({
        isPrinting: true,
        printPercent: 50,
        bedTemp: 0,
        extruderTemp: 0
      });
    });

    it('should handle invalid SD progress format', async () => {
      const mockTempInfo = {
        getBedTemp: jest.fn().mockReturnValue({
          getCurrent: jest.fn().mockReturnValue(30)
        }),
        getExtruderTemp: jest.fn().mockReturnValue({
          getCurrent: jest.fn().mockReturnValue(30)
        })
      };

      const mockPrintStatus = {
        getSdProgress: jest.fn().mockReturnValue("invalid/format")
      };

      mockClient.getTempInfo.mockResolvedValue(mockTempInfo);
      mockClient.getPrintStatus.mockResolvedValue(mockPrintStatus);

      const result = await decorator.getStatus();

      expect(result).toEqual({
        isPrinting: false,
        printPercent: 0,
        bedTemp: 30,
        extruderTemp: 30
      });
    });

    it('should handle missing temperature getters', async () => {
      const mockTempInfo = {
        getBedTemp: jest.fn().mockReturnValue(null),
        getExtruderTemp: jest.fn().mockReturnValue(null)
      };

      const mockPrintStatus = {
        getSdProgress: jest.fn().mockReturnValue("25/100")
      };

      mockClient.getTempInfo.mockResolvedValue(mockTempInfo);
      mockClient.getPrintStatus.mockResolvedValue(mockPrintStatus);

      const result = await decorator.getStatus();

      expect(result).toEqual({
        isPrinting: true,
        printPercent: 25,
        bedTemp: 0,
        extruderTemp: 0
      });
    });



    it('should be printing when extruder temperature exceeds 70', async () => {
      const mockTempInfo = {
        getBedTemp: jest.fn().mockReturnValue(39),
        getExtruderTemp: jest.fn().mockReturnValue(71)
      };

      const mockPrintStatus = {
        getSdProgress: jest.fn().mockReturnValue("0/100")
      };

      mockClient.getTempInfo.mockResolvedValue(mockTempInfo);
      mockClient.getPrintStatus.mockResolvedValue(mockPrintStatus);

      const result = await decorator.getStatus();

      expect(result).toEqual({
        isPrinting: true,
        printPercent: 0,
        bedTemp: 39,
        extruderTemp: 71
      });
    });
  });


  describe('pause', () => {
    it('should call client pauseJob method', async () => {
      mockClient.pauseJob.mockResolvedValue(true);

      const result = await decorator.pause();

      expect(result).toBe(true);
      expect(mockClient.pauseJob).toHaveBeenCalled();
    });

    it('should handle pause errors', async () => {
      const error = new Error('Pause failed');
      mockClient.pauseJob.mockRejectedValue(error);

      await expect(decorator.pause()).rejects.toThrow('Pause failed');
    });
  });

  describe('resume', () => {
    it('should call client resumeJob method', async () => {
      mockClient.resumeJob.mockResolvedValue(true);

      const result = await decorator.resume();

      expect(result).toBe(true);
      expect(mockClient.resumeJob).toHaveBeenCalled();
    });

    it('should handle resume errors', async () => {
      const error = new Error('Resume failed');
      mockClient.resumeJob.mockRejectedValue(error);

      await expect(decorator.resume()).rejects.toThrow('Resume failed');
    });
  });

  describe('getPrinterName', () => {
    it('should return printer name from client', async () => {
      const mockPrinterInfo = {
        TypeName: 'FlashForge Adventurer 3'
      };

      mockClient.getPrinterInfo.mockResolvedValue(mockPrinterInfo);

      const result = await decorator.getPrinterName();

      expect(result).toBe('FlashForge Adventurer 3');
      expect(mockClient.getPrinterInfo).toHaveBeenCalled();
    });

    it('should return empty string when printer info is null', async () => {
      mockClient.getPrinterInfo.mockResolvedValue(null);

      const result = await decorator.getPrinterName();

      expect(result).toBe('');
    });

    it('should return empty string when TypeName is missing', async () => {
      const mockPrinterInfo = {};

      mockClient.getPrinterInfo.mockResolvedValue(mockPrinterInfo);

      const result = await decorator.getPrinterName();

      expect(result).toBe('');
    });
  });

  describe('connect', () => {
    it('should call client initControl method', async () => {
      mockClient.initControl.mockResolvedValue(true);

      const result = await decorator.connect();

      expect(result).toBe(true);
      expect(mockClient.initControl).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockClient.initControl.mockRejectedValue(error);

      await expect(decorator.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('disconnect', () => {
    it('should call client stopKeepAlive method', async () => {
      mockClient.stopKeepAlive.mockResolvedValue(undefined);

      await decorator.disconnect();

      expect(mockClient.stopKeepAlive).toHaveBeenCalledWith(true);
    });

    it('should handle disconnect errors', async () => {
      const error = new Error('Disconnect failed');
      mockClient.stopKeepAlive.mockRejectedValue(error);

      await expect(decorator.disconnect()).rejects.toThrow('Disconnect failed');
    });
  });
});
