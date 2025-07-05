import { FlashForgeDevice } from './FlashForgeDevice';
import { FlashForgeClient, FlashForgeStatus, ConnectionFailedError } from './api/FlashForgeClient';

describe('FlashForgeDevice updateStatus', () => {
  let device: FlashForgeDevice;
  let mockClient: any;

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

  describe('when printer is currently printing', () => {
    const printingStatus: FlashForgeStatus = {
      isPrinting: true,
      printPercent: 75,
      bedTemp: 60,
      extruderTemp: 210,
    };

    beforeEach(() => {
      mockClient.getStatus.mockResolvedValue(printingStatus);
    });

    it('should update temperatures and capabilities when printing', async () => {
      await device.updateStatus();

      expect(device.setStoreValue).toHaveBeenCalledWith('IS_PRINTING', true);
      expect(device.setStoreValue).toHaveBeenCalledWith('IS_DELAYED_PRINTING', true);
      expect(device.updateTemperatures).toHaveBeenCalledWith(printingStatus);
      expect(device.updateCapabilities).toHaveBeenCalledWith(75, true);
    });

    it('should not check for delayed printing state when currently printing', async () => {
      await device.updateStatus();

      expect(device.getStoreValue).not.toHaveBeenCalledWith('IS_DELAYED_PRINTING');
      expect(device.isCooledDown).not.toHaveBeenCalled();
    });
  });

  describe('when printer is not printing and not in delayed printing state', () => {
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

    it('should set capabilities to 0 and false when not printing', async () => {
      await device.updateStatus();

      expect(device.setStoreValue).toHaveBeenCalledWith('IS_PRINTING', false);
      expect(device.updateTemperatures).toHaveBeenCalledWith(notPrintingStatus);
      expect(device.updateCapabilities).toHaveBeenCalledWith(0, false);
    });

    it('should not check cooling state when not in delayed printing', async () => {
      await device.updateStatus();

      expect(device.isCooledDown).not.toHaveBeenCalled();
      expect(device.cooledDown).not.toHaveBeenCalled();
    });
  });

  describe('when printer is in delayed printing state', () => {
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

      expect(device.setStoreValue).toHaveBeenCalledWith('IS_PRINTING', false);
      expect(device.updateTemperatures).toHaveBeenCalledWith(finishedPrintingStatus);
      expect(device.isCooledDown).toHaveBeenCalledWith(45);
      expect(device.updateCapabilities).toHaveBeenCalledWith(100, false);
      expect(device.cooledDown).not.toHaveBeenCalled();
    });

    it('should call cooledDown when bed temperature is below threshold', async () => {
      const cooledStatus: FlashForgeStatus = {
        ...finishedPrintingStatus,
        bedTemp: 35,
      };
      mockClient.getStatus.mockResolvedValue(cooledStatus);
      device.isCooledDown = jest.fn().mockReturnValue(true);

      await device.updateStatus();

      expect(device.setStoreValue).toHaveBeenCalledWith('IS_PRINTING', false);
      expect(device.updateTemperatures).toHaveBeenCalledWith(cooledStatus);
      expect(device.isCooledDown).toHaveBeenCalledWith(35);
      expect(device.cooledDown).toHaveBeenCalled();
      expect(device.updateCapabilities).not.toHaveBeenCalledWith(100, false);
    });

    it('should not call updateCapabilities with 0 when in delayed printing', async () => {
      device.isCooledDown = jest.fn().mockReturnValue(false);

      await device.updateStatus();

      expect(device.updateCapabilities).not.toHaveBeenCalledWith(0, false);
    });
  });

  describe('error handling', () => {
    it('should call handleError and set capabilities to 0 when getStatus throws', async () => {
      const error = new Error('Connection timeout');
      mockClient.getStatus.mockRejectedValue(error);

      await device.updateStatus();

      expect(device.handleError).toHaveBeenCalledWith(error);
      expect(device.updateCapabilities).toHaveBeenCalledWith(0, false);
    });

    it('should call handleError and set capabilities to 0 when ConnectionFailedError is thrown', async () => {
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
    it('should handle transition from printing to delayed printing', async () => {
      const printingStatus: FlashForgeStatus = {
        isPrinting: true,
        printPercent: 100,
        bedTemp: 65,
        extruderTemp: 200,
      };
      
      mockClient.getStatus.mockResolvedValue(printingStatus);
      await device.updateStatus();

      expect(device.setStoreValue).toHaveBeenCalledWith('IS_PRINTING', true);
      expect(device.setStoreValue).toHaveBeenCalledWith('IS_DELAYED_PRINTING', true);
      expect(device.updateCapabilities).toHaveBeenCalledWith(100, true);
    });

    it('should handle complete print cycle from printing to cooled down', async () => {
      const printingStatus: FlashForgeStatus = {
        isPrinting: true,
        printPercent: 100,
        bedTemp: 65,
        extruderTemp: 200,
      };
      
      const finishedStatus: FlashForgeStatus = {
        isPrinting: false,
        printPercent: 100,
        bedTemp: 30,
        extruderTemp: 25,
      };

      mockClient.getStatus.mockResolvedValue(printingStatus);
      await device.updateStatus();

      device.getStoreValue = jest.fn().mockReturnValue(true);
      device.isCooledDown = jest.fn().mockReturnValue(true);
      mockClient.getStatus.mockResolvedValue(finishedStatus);
      
      await device.updateStatus();

      expect(device.cooledDown).toHaveBeenCalled();
    });
  });
});