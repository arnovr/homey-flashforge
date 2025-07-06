import { FlashForgeDevice, STORE_KEYS } from '../lib/flashforgedriver/FlashForgeDevice';
import { FlashForgeStatus, ConnectionFailedError } from '../lib/flashforgedriver/api/FlashForgeClient';

describe('FlashForgeDevice updateStatus', () => {
  let device: FlashForgeDevice;
  let mockClient: jest.Mocked<any>;

  beforeEach(() => {
    mockClient = {
      getStatus: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      isPrinting: jest.fn(),
      getPrinterName: jest.fn(),
    };

    device = new FlashForgeDevice();
    device.client = mockClient;
    device.updateTemperatures = jest.fn();
    device.updateCapabilities = jest.fn();
    device.handleError = jest.fn();
    device.cooledDown = jest.fn();
    device.isCooledDown = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when client is not initialized', () => {
    it('should return early when client is undefined', async () => {
      device.client = undefined;
      
      await device.updateStatus();
      
      expect(mockClient.getStatus).not.toHaveBeenCalled();
      expect(device.updateCapabilities).not.toHaveBeenCalled();
    });
  });

  describe('when printing', () => {
    const printingStatus: FlashForgeStatus = {
      isPrinting: true,
      printPercent: 75,
      bedTemp: 60,
      extruderTemp: 210,
    };

    beforeEach(() => {
      mockClient.getStatus.mockResolvedValue(printingStatus);
    });

    it('should update temperatures and capabilities', async () => {
      await device.updateStatus();

      expect(device.setStoreValue).toHaveBeenCalledWith(STORE_KEYS.IS_PRINTING, true);
      expect(device.setStoreValue).toHaveBeenCalledWith(STORE_KEYS.IS_DELAYED_PRINTING, true);
      expect(device.updateTemperatures).toHaveBeenCalledWith(printingStatus);
      expect(device.updateCapabilities).toHaveBeenCalledWith(75, true);
    });

    it('should not check for delayed printing state', async () => {
      await device.updateStatus();

      expect(device.getStoreValue).not.toHaveBeenCalledWith(STORE_KEYS.IS_DELAYED_PRINTING);
      expect(device.isCooledDown).not.toHaveBeenCalled();
    });
  });

  describe('when not printing and not delayed', () => {
    const notPrintingStatus: FlashForgeStatus = {
      isPrinting: false,
      printPercent: 0,
      bedTemp: 25,
      extruderTemp: 25,
    };

    beforeEach(() => {
      mockClient.getStatus.mockResolvedValue(notPrintingStatus);
      device.getStoreValue = jest.fn().mockReturnValue(false);
    });

    it('should set restore capabilities', async () => {
      await device.updateStatus();

      expect(device.setStoreValue).toHaveBeenCalledWith(STORE_KEYS.IS_PRINTING, false);
      expect(device.updateTemperatures).toHaveBeenCalledWith(notPrintingStatus);
      expect(device.updateCapabilities).toHaveBeenCalledWith(0, false);
    });

    it('should not check cooling state', async () => {
      await device.updateStatus();

      expect(device.isCooledDown).not.toHaveBeenCalled();
      expect(device.cooledDown).not.toHaveBeenCalled();
    });
  });

  describe('when delayed printing', () => {
    const finishedPrintingStatus: FlashForgeStatus = {
      isPrinting: false,
      printPercent: 100,
      bedTemp: 45,
      extruderTemp: 30,
    };

    beforeEach(() => {
      mockClient.getStatus.mockResolvedValue(finishedPrintingStatus);
      device.getStoreValue = jest.fn().mockReturnValue(true);
    });

    it('should maintain 100% progress when bed is still hot', async () => {
      device.isCooledDown = jest.fn().mockReturnValue(false);

      await device.updateStatus();

      expect(device.setStoreValue).toHaveBeenCalledWith(STORE_KEYS.IS_PRINTING, false);
      expect(device.updateTemperatures).toHaveBeenCalledWith(finishedPrintingStatus);
      expect(device.isCooledDown).toHaveBeenCalledWith(45);
      expect(device.updateCapabilities).toHaveBeenCalledWith(100, false);
      expect(device.cooledDown).not.toHaveBeenCalled();
    });

    it('should cool down when bed temperature became below threshold', async () => {
      const cooledStatus: FlashForgeStatus = {
        ...finishedPrintingStatus,
        bedTemp: 35,
      };
      mockClient.getStatus.mockResolvedValue(cooledStatus);
      device.isCooledDown = jest.fn().mockReturnValue(true);

      await device.updateStatus();

      expect(device.setStoreValue).toHaveBeenCalledWith(STORE_KEYS.IS_PRINTING, false);
      expect(device.updateTemperatures).toHaveBeenCalledWith(cooledStatus);
      expect(device.isCooledDown).toHaveBeenCalledWith(35);
      expect(device.cooledDown).toHaveBeenCalled();
      expect(device.updateCapabilities).not.toHaveBeenCalledWith(100, false);
    });

    it('should not restore capabilities when in delayed printing', async () => {
      device.isCooledDown = jest.fn().mockReturnValue(false);

      await device.updateStatus();

      expect(device.updateCapabilities).not.toHaveBeenCalledWith(0, false);
    });
  });

  describe('error handling', () => {
    it('should call handleError restore capabilities', async () => {
      const error = new Error('Connection timeout');
      mockClient.getStatus.mockRejectedValue(error);

      await device.updateStatus();

      expect(device.handleError).toHaveBeenCalledWith(error);
      expect(device.updateCapabilities).toHaveBeenCalledWith(0, false);
    });

    it('should call handleError restore capabilities on ConnectionFailedError', async () => {
      const error = new ConnectionFailedError();
      mockClient.getStatus.mockRejectedValue(error);

      await device.updateStatus();

      expect(device.handleError).toHaveBeenCalledWith(error);
      expect(device.updateCapabilities).toHaveBeenCalledWith(0, false);
    });

    it('should not update temperatures when error occurs', async () => {
      const error = new Error('Network error');
      mockClient.getStatus.mockRejectedValue(error);

      await device.updateStatus();

      expect(device.updateTemperatures).not.toHaveBeenCalled();
      expect(device.setStoreValue).not.toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('when printing is finished move to delayed printing', async () => {
      const printingStatus: FlashForgeStatus = {
        isPrinting: true,
        printPercent: 100,
        bedTemp: 65,
        extruderTemp: 200,
      };
      
      mockClient.getStatus.mockResolvedValue(printingStatus);
      await device.updateStatus();

      expect(device.setStoreValue).toHaveBeenCalledWith(STORE_KEYS.IS_PRINTING, true);
      expect(device.setStoreValue).toHaveBeenCalledWith(STORE_KEYS.IS_DELAYED_PRINTING, true);
      expect(device.updateCapabilities).toHaveBeenCalledWith(100, true);
    });

    it('should cooldown after printing is finished', async () => {
      const initialPrintStatus: FlashForgeStatus = {
        isPrinting: false,
        printPercent: 0,
        bedTemp: 30,
        extruderTemp: 30,
      };

      const printingStatus: FlashForgeStatus = {
        isPrinting: true,
        printPercent: 70,
        bedTemp: 65,
        extruderTemp: 200,
      };
      
      const finishedStatus: FlashForgeStatus = {
        isPrinting: false,
        printPercent: 100,
        bedTemp: 30,
        extruderTemp: 25,
      };


      mockClient.getStatus.mockResolvedValue(initialPrintStatus);
      await device.updateStatus();
      expect(device.updateCapabilities).toHaveBeenCalledWith(0, false);

      expect(device.cooledDown).not.toHaveBeenCalled();

      mockClient.getStatus.mockResolvedValue(printingStatus);
      await device.updateStatus();

      expect(device.updateCapabilities).toHaveBeenCalledWith(70, true);
      expect(device.cooledDown).not.toHaveBeenCalled();
      
      device.getStoreValue = jest.fn().mockReturnValue(true);
      device.isCooledDown = jest.fn().mockReturnValue(true);
      mockClient.getStatus.mockResolvedValue(finishedStatus);
      
      await device.updateStatus();

      expect(device.updateCapabilities).toHaveBeenCalledWith(0, false);
      expect(device.cooledDown).toHaveBeenCalled();
    });
  });
});

describe('FlashForgeDevice handleButton', () => {
  let device: FlashForgeDevice;
  let mockClient: jest.Mocked<any>;

  beforeEach(() => {
    mockClient = {
      getStatus: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      isPrinting: jest.fn(),
      getPrinterName: jest.fn(),
    };

    device = new FlashForgeDevice();
    device.client = mockClient;
    device.setStoreValue = jest.fn();
    device.setCapabilityValue = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when client is not initialized', () => {
    it('should throw error when client is undefined', async () => {
      device.client = undefined;

      await expect(device.handleButton(true)).rejects.toThrow('Er is geen client geïnitialiseerd.');
      await expect(device.handleButton(false)).rejects.toThrow('Er is geen client geïnitialiseerd.');
    });
  });

  describe('when printer is printing', () => {
    beforeEach(() => {
      mockClient.isPrinting.mockResolvedValue(true);
    });

    it('should resume printing when value is true', async () => {
      await device.handleButton(true);

      expect(mockClient.isPrinting).toHaveBeenCalled();
      expect(mockClient.resume).toHaveBeenCalled();
      expect(mockClient.pause).not.toHaveBeenCalled();
      expect(device.setStoreValue).toHaveBeenCalledWith(STORE_KEYS.IS_PAUSED, false);
      expect(device.setCapabilityValue).toHaveBeenCalledWith('onoff', true);
    });

    it('should pause printing when value is false', async () => {
      await device.handleButton(false);

      expect(mockClient.isPrinting).toHaveBeenCalled();
      expect(mockClient.pause).toHaveBeenCalled();
      expect(mockClient.resume).not.toHaveBeenCalled();
      expect(device.setStoreValue).toHaveBeenCalledWith(STORE_KEYS.IS_PAUSED, true);
      expect(device.setCapabilityValue).toHaveBeenCalledWith('onoff', false);
    });

    it('should handle client errors during resume', async () => {
      const error = new Error('Resume failed');
      mockClient.resume.mockRejectedValue(error);

      await expect(device.handleButton(true)).rejects.toThrow('Resume failed');
      expect(mockClient.resume).toHaveBeenCalled();
      expect(device.setStoreValue).toHaveBeenCalledWith(STORE_KEYS.IS_PAUSED, false);
    });

    it('should handle client errors during pause', async () => {
      const error = new Error('Pause failed');
      mockClient.pause.mockRejectedValue(error);

      await expect(device.handleButton(false)).rejects.toThrow('Pause failed');
      expect(mockClient.pause).toHaveBeenCalled();
      expect(device.setStoreValue).toHaveBeenCalledWith(STORE_KEYS.IS_PAUSED, true);
    });
  });

  describe('when printer is not printing', () => {
    beforeEach(() => {
      mockClient.isPrinting.mockResolvedValue(false);
    });

    it('should throw error when trying to resume with value true', async () => {
      await expect(device.handleButton(true)).rejects.toThrow(
        'Kan geen print hervatten als er geen print bezig is.',
      );

      expect(mockClient.isPrinting).toHaveBeenCalled();
      expect(mockClient.resume).not.toHaveBeenCalled();
      expect(mockClient.pause).not.toHaveBeenCalled();
      expect(device.setStoreValue).not.toHaveBeenCalled();
      expect(device.setCapabilityValue).not.toHaveBeenCalled();
    });

    it('should throw error when trying to pause with value false', async () => {
      await expect(device.handleButton(false)).rejects.toThrow(
        'Kan geen print pauzeren als er geen print bezig is.',
      );

      expect(mockClient.isPrinting).toHaveBeenCalled();
      expect(mockClient.resume).not.toHaveBeenCalled();
      expect(mockClient.pause).not.toHaveBeenCalled();
      expect(device.setStoreValue).not.toHaveBeenCalled();
      expect(device.setCapabilityValue).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle isPrinting errors', async () => {
      const error = new Error('isPrinting failed');
      mockClient.isPrinting.mockRejectedValue(error);

      await expect(device.handleButton(true)).rejects.toThrow('isPrinting failed');
      expect(mockClient.isPrinting).toHaveBeenCalled();
      expect(mockClient.resume).not.toHaveBeenCalled();
      expect(mockClient.pause).not.toHaveBeenCalled();
    });
  });
});