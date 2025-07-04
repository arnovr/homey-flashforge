'use strict';

import Homey from 'homey';

module.exports = class FlashForgeApp extends Homey.App {
  async onInit() {
    this.log('FlashForgeApp has been initialized');
  }

}
