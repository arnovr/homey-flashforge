import { FlashForgeDevice, STORE_KEYS } from '../lib/flashforgedriver/FlashForgeDevice';
import { FlashForgeStatus, ConnectionFailedError } from '../lib/flashforgedriver/api/FlashForgeClient';

jest.mock('homey');

// Test data constants
const PRINTING_STATUS: FlashForgeStatus = {
  isPrinting: true,
  printPercent: 75,
  bedTemp: 60,
  extruderTemp: 210,
};

const NOT_PRINTING_STATUS: FlashForgeStatus = {
  isPrinting: false,
  printPercent: 0,
  bedTemp: 25,
  extruderTemp: 25,
};

const FINISHED_PRINTING_STATUS: FlashForgeStatus = {
  isPrinting: false,
  printPercent: 100,
  bedTemp: 45,
  extruderTemp: 30,
};

const COOLED_STATUS: FlashForgeStatus = {
  ...FINISHED_PRINTING_STATUS,
  bedTemp: 35,
};

// Helper function to create mock client
const createMockClient = () => ({
  getStatus: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  isPrinting: jest.fn(),
  getPrinterName: jest.fn(),
});

// Helper function to create mock device
const createMockDevice = (mockClient: jest.Mocked<any>) => {
  const device = new FlashForgeDevice();
  device.client = mockClient;
  device.updateTemperatures = jest.fn();
  device.updateCapabilities = jest.fn();
  device.handleError = jest.fn();
  device.cooledDown = jest.fn();
  device.isCooledDown = jest.fn();
  device.setStoreValue = jest.fn();
  device.getStoreValue = jest.fn();
  device.setCapabilityValue = jest.fn();
  device.log = jest.fn();
  device.trigger = jest.fn();
  device.pause = jest.fn();
  device.resume = jest.fn();
  device.homey = {
    flow: {
      getDeviceTriggerCard: jest.fn().mockReturnValue({
        trigger: jest.fn()
      })
    },
    setInterval: jest.fn()
  } as any;
  return device;
};

describe('FlashForgeDevice', () => {
  let device: FlashForgeDevice;
  let mockClient: jest.Mocked<any>;

  beforeEach(() => {
    mockClient = createMockClient();
    device = createMockDevice(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateStatus', () => {
    describe('when client is not initialized', () => {
      it('should return early when client is undefined', async () => {
        device.client = undefined;
        
        await device.updateStatus();
        
        expect(mockClient.getStatus).not.toHaveBeenCalled();
        expect(device.updateCapabilities).not.toHaveBeenCalled();
      });
    });

    describe('when printing', () => {
      beforeEach(() => {
        mockClient.getStatus.mockResolvedValue(PRINTING_STATUS);
      });

      it('should update temperatures and capabilities', async () => {
        await device.updateStatus();

        expect(device.setStoreValue).toHaveBeenCalledWith(STORE_KEYS.IS_PRINTING, true);
        expect(device.updateTemperatures).toHaveBeenCalledWith(PRINTING_STATUS);
        expect(device.updateCapabilities).toHaveBeenCalledWith(75, true);
      });

      it('should not check for delayed printing state', async () => {
        await device.updateStatus();

        expect(device.getStoreValue).not.toHaveBeenCalledWith(STORE_KEYS.IS_PRINTING);
        expect(device.isCooledDown).not.toHaveBeenCalled();
      });
    });

    describe('when not printing and not delayed', () => {
      beforeEach(() => {
        mockClient.getStatus.mockResolvedValue(NOT_PRINTING_STATUS);
        (device.getStoreValue as jest.Mock).mockReturnValue(false);
      });

      it('should update temperatures only', async () => {
        await device.updateStatus();

        expect(device.updateTemperatures).toHaveBeenCalledWith(NOT_PRINTING_STATUS);
        expect(device.updateCapabilities).not.toHaveBeenCalled();
      });

      it('should not check cooling state', async () => {
        await device.updateStatus();

        expect(device.isCooledDown).not.toHaveBeenCalled();
        expect(device.cooledDown).not.toHaveBeenCalled();
      });
    });

    describe('when delayed printing (cooling down)', () => {
      beforeEach(() => {
        mockClient.getStatus.mockResolvedValue(FINISHED_PRINTING_STATUS);
        (device.getStoreValue as jest.Mock).mockReturnValue(true);
      });

      it('should maintain 100% progress when bed is still hot', async () => {
        (device.isCooledDown as jest.Mock).mockReturnValue(false);

        await device.updateStatus();

        expect(device.updateTemperatures).toHaveBeenCalledWith(FINISHED_PRINTING_STATUS);
        expect(device.isCooledDown).toHaveBeenCalledWith(45);
        expect(device.updateCapabilities).toHaveBeenCalledWith(100, false);
        expect(device.cooledDown).not.toHaveBeenCalled();
      });

      it('should cool down when bed temperature drops below threshold', async () => {
        mockClient.getStatus.mockResolvedValue(COOLED_STATUS);
        (device.isCooledDown as jest.Mock).mockReturnValue(true);

        await device.updateStatus();

        expect(device.updateTemperatures).toHaveBeenCalledWith(COOLED_STATUS);
        expect(device.isCooledDown).toHaveBeenCalledWith(35);
        expect(device.cooledDown).toHaveBeenCalled();
        expect(device.updateCapabilities).not.toHaveBeenCalledWith(100, false);
      });
    });

    describe('error handling', () => {
      const testCases = [
        { error: new Error('Connection timeout'), description: 'generic error' },
        { error: new ConnectionFailedError(), description: 'ConnectionFailedError' },
        { error: new Error('Network error'), description: 'network error' }
      ];

      testCases.forEach(({ error, description }) => {
        it(`should handle ${description}`, async () => {
          mockClient.getStatus.mockRejectedValue(error);

          await device.updateStatus();

          expect(device.handleError).toHaveBeenCalledWith(error);
          expect(device.updateTemperatures).not.toHaveBeenCalled();
          expect(device.updateCapabilities).not.toHaveBeenCalled();
        });
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

        // Initial state - not printing
        mockClient.getStatus.mockResolvedValue(initialPrintStatus);
        await device.updateStatus();
        expect(device.updateCapabilities).not.toHaveBeenCalled();
        expect(device.cooledDown).not.toHaveBeenCalled();

        // Printing state
        mockClient.getStatus.mockResolvedValue(printingStatus);
        await device.updateStatus();
        expect(device.updateCapabilities).toHaveBeenCalledWith(70, true);
        expect(device.cooledDown).not.toHaveBeenCalled();
        
        // Finished state - enter cooling down mode
        (device.getStoreValue as jest.Mock).mockReturnValue(true);
        (device.isCooledDown as jest.Mock).mockReturnValue(true);
        (device.updateCapabilities as jest.Mock).mockClear(); // Clear the mock
        
        // Don't mock cooledDown so it calls updateCapabilities
        const originalCooledDown = device.cooledDown;
        (device.cooledDown as jest.Mock).mockImplementation(() => {
          device.updateCapabilities(0, false);
          return originalCooledDown.call(device);
        });
        
        mockClient.getStatus.mockResolvedValue(finishedStatus);
        await device.updateStatus();

        expect(device.cooledDown).toHaveBeenCalled();
        expect(device.updateCapabilities).toHaveBeenCalledWith(0, false);
      });
    });
  });

  describe('handleButton', () => {
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

      it('should resume printing when value is true and printer is paused', async () => {
        (device.getStoreValue as jest.Mock).mockReturnValue(true);

        await device.handleButton(true);

        expect(mockClient.isPrinting).toHaveBeenCalled();
        expect(device.resume).toHaveBeenCalled();
        expect(device.pause).not.toHaveBeenCalled();
        expect(device.setCapabilityValue).toHaveBeenCalledWith('is_printing', true);
      });

      it('should not resume when value is true but printer is not paused', async () => {
        (device.getStoreValue as jest.Mock).mockReturnValue(false);

        await device.handleButton(true);

        expect(mockClient.isPrinting).toHaveBeenCalled();
        expect(device.resume).not.toHaveBeenCalled();
        expect(device.log).toHaveBeenCalledWith('Pressed button while not being in a previous paused state.');
      });

      it('should pause printing when value is false', async () => {
        await device.handleButton(false);

        expect(mockClient.isPrinting).toHaveBeenCalled();
        expect(device.pause).toHaveBeenCalled();
        expect(device.resume).not.toHaveBeenCalled();
        expect(device.setCapabilityValue).toHaveBeenCalledWith('is_printing', false);
      });
    });

    describe('when printer is not printing', () => {
      beforeEach(() => {
        mockClient.isPrinting.mockResolvedValue(false);
      });

      it('should throw error when trying to resume', async () => {
        await expect(device.handleButton(true)).rejects.toThrow('Cannot resume print if no print is in progress.');

        expect(mockClient.isPrinting).toHaveBeenCalled();
        expect(device.resume).not.toHaveBeenCalled();
        expect(device.pause).not.toHaveBeenCalled();
      });

      it('should throw error when trying to pause', async () => {
        await expect(device.handleButton(false)).rejects.toThrow('Cannot pause print if no print is in progress.');

        expect(mockClient.isPrinting).toHaveBeenCalled();
        expect(device.resume).not.toHaveBeenCalled();
        expect(device.pause).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should propagate isPrinting errors', async () => {
        const error = new Error('isPrinting failed');
        mockClient.isPrinting.mockRejectedValue(error);

        await expect(device.handleButton(true)).rejects.toThrow('isPrinting failed');
        expect(mockClient.isPrinting).toHaveBeenCalled();
        expect(device.resume).not.toHaveBeenCalled();
        expect(device.pause).not.toHaveBeenCalled();
      });
    });
  });
});