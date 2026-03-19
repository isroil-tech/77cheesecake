import { Controller, Get, Put, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('api/v1/settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  async getSettings() {
    return this.settingsService.getAll();
  }

  @Put()
  async updateSettings(@Body() body: Record<string, string>) {
    for (const [key, value] of Object.entries(body)) {
      await this.settingsService.set(key, value);
    }
    return { success: true, ...(await this.settingsService.getAll()) };
  }
}
