import { Injectable } from '@nestjs/common';
import { uz } from './uz';
import { ru } from './ru';

const translations: Record<string, Record<string, string>> = { uz, ru };

@Injectable()
export class I18nService {
  t(lang: string, key: string, params?: Record<string, string>): string {
    const dict = translations[lang] || translations['uz'];
    let text = dict[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  }
}
