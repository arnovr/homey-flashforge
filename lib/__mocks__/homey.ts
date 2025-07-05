export class Device {
  log = jest.fn();
  setStoreValue = jest.fn();
  getStoreValue = jest.fn();
  setCapabilityValue = jest.fn();
  homey = {
    flow: {
      getTriggerCard: jest.fn().mockReturnValue({
        trigger: jest.fn(),
      }),
    },
  };
}

export default {
  Device,
};