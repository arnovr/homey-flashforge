# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a Homey app for connecting FlashForge 3D printers (Adventurer 3, 4, 5M, 5M Pro) to the Homey smart home platform. The app monitors printer status including bed temperature, extruder temperature, and print progress.

## Development Commands

### Build and Lint
- `npm run build` - Compile TypeScript to JavaScript (outputs to `.homeybuild/`)
- `npm run lint` - Run ESLint on JavaScript and TypeScript files

### Development Workflow
- The app uses `.homeycompose/` for configuration composition - modify files there instead of `app.json` directly
- TypeScript compilation uses Node 16 target with `allowJs: true`
- ESLint configuration extends `athom/homey-app` rules

## Architecture

### Core Components
- **FlashForgeClient**: Main client abstraction that handles different printer API versions
  - Uses `GhostFlashForgeClientDecorator` for older printers (Adventurer 3/4)
  - Uses `FiveMClientDecorator` for newer printers (Adventurer 5M/Pro) with checkCode
- **FlashForgeDevice**: Base device class handling printer polling, status updates, and capabilities
- **FlashForgeManualDriver**: Manual pairing driver for IP address input
- **FlashForgeDiscoveryDriver**: Auto-discovery driver using ff-5mp-api-ts library

### Driver Structure
- `drivers/adventurer-3-4/`: Manual IP configuration, no auto-discovery
- `drivers/adventurer-5m/`: Auto-discovery support with printer ID requirement

### Key Features
- **Polling**: 30-second intervals for status updates
- **Delayed Printing State**: Continues showing 100% progress until bed cools down (<40°C)
- **Flow Triggers**: Print percentage changes, temperature changes, print completion
- **Capabilities**: on/off (pause/resume), temperature monitoring, print progress

### API Abstraction
The `NormalizedPrinterClient` interface provides unified access to different FlashForge APIs:
- Connection management (connect/disconnect)
- Status monitoring (temperatures, print progress)
- Print control (pause/resume)
- Printer information

### Error Handling
- `ConnectionFailedError` for printer connectivity issues
- Console log suppression using `ConsoleLogUtils` to reduce noise from ff-5mp-api-ts

### Configuration Files
- `.homeycompose/app.json`: Main app configuration
- `.homeycompose/capabilities/`: Custom capability definitions
- `.homeycompose/flow/triggers/`: Flow trigger definitions
- Settings stored per device: IP address, printer ID (checkCode for 5M models)

## Development Notes
- The app depends on `ff-5mp-api-ts` for newer printer communication
- Older printers use a different API accessed through GhostFlashForgeClient
- Print completion detection includes a cooling phase before marking as truly finished
- All printer communication is wrapped with connection management