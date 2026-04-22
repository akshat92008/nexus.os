/**
 * Nexus OS — Internationalization / Localization Manager
 * Inspired by OpenClaw's i18n system
 */
import { logger } from '../logger.js';
import { promises as fs } from 'fs';
import path from 'path';

export type SupportedLocale = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh' | 'ar' | 'hi' | 'ru';

export interface LocaleStrings {
  [key: string]: string | LocaleStrings;
}

export interface LocaleData {
  locale: SupportedLocale;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  translations: LocaleStrings;
  dateFormat: string;
  timeFormat: string;
  currency: string;
}

class I18nManager {
  private locales: Map<SupportedLocale, LocaleData> = new Map();
  private currentLocale: SupportedLocale = 'en';
  private fallbackLocale: SupportedLocale = 'en';
  private loaded: boolean = false;

  async initialize() {
    logger.info('[I18nManager] Initializing i18n system...');
    await this.loadBuiltInLocales();
    logger.info(`[I18nManager] Loaded ${this.locales.size} locales`);
  }

  private async loadBuiltInLocales() {
    // Core English strings
    this.locales.set('en', {
      locale: 'en',
      name: 'English',
      nativeName: 'English',
      direction: 'ltr',
      translations: {
        app: { name: 'Nexus OS', tagline: 'Your AI Employee' },
        agent: {
          spawn: 'Agent spawned',
          complete: 'Agent completed',
          error: 'Agent error',
          thinking: 'Thinking...',
          executing: 'Executing...'
        },
        mission: {
          created: 'Mission created',
          running: 'Mission running',
          paused: 'Mission paused',
          completed: 'Mission completed',
          failed: 'Mission failed',
          rollback: 'Rolling back...'
        },
        skill: {
          installed: 'Skill installed',
          executed: 'Skill executed',
          error: 'Skill error',
          notFound: 'Skill not found'
        },
        channel: {
          connected: 'Channel connected',
          disconnected: 'Channel disconnected',
          messageReceived: 'Message received',
          messageSent: 'Message sent'
        },
        memory: {
          stored: 'Memory stored',
          recalled: 'Memory recalled',
          searchResults: '{count} memories found',
          compacted: 'Memories compacted'
        },
        system: {
          ready: 'System ready',
          degraded: 'System degraded',
          error: 'System error',
          loading: 'Loading...'
        },
        ui: {
          yes: 'Yes',
          no: 'No',
          cancel: 'Cancel',
          confirm: 'Confirm',
          save: 'Save',
          delete: 'Delete',
          edit: 'Edit',
          create: 'Create',
          search: 'Search',
          filter: 'Filter',
          settings: 'Settings',
          help: 'Help',
          back: 'Back',
          next: 'Next',
          previous: 'Previous',
          submit: 'Submit'
        }
      },
      dateFormat: 'YYYY-MM-DD',
      timeFormat: 'HH:mm:ss',
      currency: 'USD'
    });

    // Spanish
    this.locales.set('es', {
      locale: 'es',
      name: 'Spanish',
      nativeName: 'Español',
      direction: 'ltr',
      translations: {
        app: { name: 'Nexus OS', tagline: 'Tu Empleado IA' },
        agent: { spawn: 'Agente iniciado', complete: 'Agente completado', error: 'Error del agente', thinking: 'Pensando...', executing: 'Ejecutando...' },
        mission: { created: 'Misión creada', running: 'Misión en curso', paused: 'Misión pausada', completed: 'Misión completada', failed: 'Misión fallida', rollback: 'Revirtiendo...' },
        skill: { installed: 'Habilidad instalada', executed: 'Habilidad ejecutada', error: 'Error de habilidad', notFound: 'Habilidad no encontrada' },
        channel: { connected: 'Canal conectado', disconnected: 'Canal desconectado', messageReceived: 'Mensaje recibido', messageSent: 'Mensaje enviado' },
        memory: { stored: 'Memoria almacenada', recalled: 'Memoria recuperada', searchResults: '{count} memorias encontradas', compacted: 'Memorias compactadas' },
        system: { ready: 'Sistema listo', degraded: 'Sistema degradado', error: 'Error del sistema', loading: 'Cargando...' },
        ui: { yes: 'Sí', no: 'No', cancel: 'Cancelar', confirm: 'Confirmar', save: 'Guardar', delete: 'Eliminar', edit: 'Editar', create: 'Crear', search: 'Buscar', filter: 'Filtrar', settings: 'Configuración', help: 'Ayuda', back: 'Atrás', next: 'Siguiente', previous: 'Anterior', submit: 'Enviar' }
      },
      dateFormat: 'DD/MM/YYYY',
      timeFormat: 'HH:mm:ss',
      currency: 'EUR'
    });

    // Japanese
    this.locales.set('ja', {
      locale: 'ja',
      name: 'Japanese',
      nativeName: '日本語',
      direction: 'ltr',
      translations: {
        app: { name: 'Nexus OS', tagline: 'あなたのAI従業員' },
        agent: { spawn: 'エージェント起動', complete: 'エージェント完了', error: 'エージェントエラー', thinking: '考え中...', executing: '実行中...' },
        mission: { created: 'ミッション作成', running: 'ミッション実行中', paused: 'ミッション一時停止', completed: 'ミッション完了', failed: 'ミッション失敗', rollback: 'ロールバック中...' },
        skill: { installed: 'スキルインストール済み', executed: 'スキル実行済み', error: 'スキルエラー', notFound: 'スキルが見つかりません' },
        channel: { connected: 'チャンネル接続済み', disconnected: 'チャンネル切断', messageReceived: 'メッセージ受信', messageSent: 'メッセージ送信' },
        memory: { stored: 'メモリ保存済み', recalled: 'メモリ呼び出し済み', searchResults: '{count}件のメモリが見つかりました', compacted: 'メモリ圧縮済み' },
        system: { ready: 'システム準備完了', degraded: 'システム劣化', error: 'システムエラー', loading: '読み込み中...' },
        ui: { yes: 'はい', no: 'いいえ', cancel: 'キャンセル', confirm: '確認', save: '保存', delete: '削除', edit: '編集', create: '作成', search: '検索', filter: 'フィルタ', settings: '設定', help: 'ヘルプ', back: '戻る', next: '次へ', previous: '前へ', submit: '送信' }
      },
      dateFormat: 'YYYY/MM/DD',
      timeFormat: 'HH:mm:ss',
      currency: 'JPY'
    });

    // Arabic (RTL)
    this.locales.set('ar', {
      locale: 'ar',
      name: 'Arabic',
      nativeName: 'العربية',
      direction: 'rtl',
      translations: {
        app: { name: 'Nexus OS', tagline: 'موظف الذكاء الاصطناعي الخاص بك' },
        agent: { spawn: 'تم تشغيل الوكيل', complete: 'اكتمل الوكيل', error: 'خطأ في الوكيل', thinking: 'جاري التفكير...', executing: 'جاري التنفيذ...' },
        mission: { created: 'تم إنشاء المهمة', running: 'المهمة قيد التشغيل', paused: 'المهمة متوقفة مؤقتاً', completed: 'اكتملت المهمة', failed: 'فشلت المهمة', rollback: 'جاري التراجع...' },
        skill: { installed: 'تم تثبيت المهارة', executed: 'تم تنفيذ المهارة', error: 'خطأ في المهارة', notFound: 'المهارة غير موجودة' },
        channel: { connected: 'تم الاتصال بالقناة', disconnected: 'تم قطع الاتصال', messageReceived: 'تم استلام الرسالة', messageSent: 'تم إرسال الرسالة' },
        memory: { stored: 'تم تخزين الذاكرة', recalled: 'تم استدعاء الذاكرة', searchResults: 'تم العثور على {count} ذاكرة', compacted: 'تم ضغط الذكريات' },
        system: { ready: 'النظام جاهز', degraded: 'النظام منخفض', error: 'خطأ في النظام', loading: 'جاري التحميل...' },
        ui: { yes: 'نعم', no: 'لا', cancel: 'إلغاء', confirm: 'تأكيد', save: 'حفظ', delete: 'حذف', edit: 'تحرير', create: 'إنشاء', search: 'بحث', filter: 'تصفية', settings: 'الإعدادات', help: 'مساعدة', back: 'رجوع', next: 'التالي', previous: 'السابق', submit: 'إرسال' }
      },
      dateFormat: 'DD/MM/YYYY',
      timeFormat: 'HH:mm:ss',
      currency: 'SAR'
    });

    // Hindi
    this.locales.set('hi', {
      locale: 'hi',
      name: 'Hindi',
      nativeName: 'हिन्दी',
      direction: 'ltr',
      translations: {
        app: { name: 'Nexus OS', tagline: 'आपका AI कर्मचारी' },
        agent: { spawn: 'एजेंट सक्रिय', complete: 'एजेंट पूरा हुआ', error: 'एजेंट त्रुटि', thinking: 'विचार कर रहा है...', executing: 'निष्पादित कर रहा है...' },
        mission: { created: 'मिशन बनाया गया', running: 'मिशन चल रहा है', paused: 'मिशन रुका हुआ', completed: 'मिशन पूरा हुआ', failed: 'मिशन विफल', rollback: 'वापस ले रहा है...' },
        skill: { installed: 'कौशल स्थापित', executed: 'कौशल निष्पादित', error: 'कौशल त्रुटि', notFound: 'कौशल नहीं मिला' },
        channel: { connected: 'चैनल जुड़ा', disconnected: 'चैनल डिस्कनेक्ट', messageReceived: 'संदेश प्राप्त हुआ', messageSent: 'संदेश भेजा गया' },
        memory: { stored: 'स्मृति संग्रहीत', recalled: 'स्मृति याद', searchResults: '{count} स्मृतियाँ मिलीं', compacted: 'स्मृतियाँ संकुचित' },
        system: { ready: 'सिस्टम तैयार', degraded: 'सिस्टम कमजोर', error: 'सिस्टम त्रुटि', loading: 'लोड हो रहा है...' },
        ui: { yes: 'हाँ', no: 'नहीं', cancel: 'रद्द करें', confirm: 'पुष्टि करें', save: 'सहेजें', delete: 'हटाएं', edit: 'संपादित करें', create: 'बनाएं', search: 'खोजें', filter: 'फ़िल्टर', settings: 'सेटिंग्स', help: 'सहायता', back: 'पीछे', next: 'अगला', previous: 'पिछला', submit: 'जमा करें' }
      },
      dateFormat: 'DD/MM/YYYY',
      timeFormat: 'HH:mm:ss',
      currency: 'INR'
    });
  }

  setLocale(locale: SupportedLocale) {
    if (!this.locales.has(locale)) {
      logger.warn(`[I18nManager] Locale ${locale} not loaded, falling back to ${this.fallbackLocale}`);
      this.currentLocale = this.fallbackLocale;
      return;
    }
    this.currentLocale = locale;
    logger.info(`[I18nManager] Locale set to: ${locale}`);
  }

  getLocale(): SupportedLocale {
    return this.currentLocale;
  }

  t(key: string, params?: Record<string, string | number>): string {
    const locale = this.locales.get(this.currentLocale) || this.locales.get(this.fallbackLocale)!;
    
    const parts = key.split('.');
    let value: any = locale.translations;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        // Fallback to English
        const fallback = this.locales.get(this.fallbackLocale)!;
        let fbValue: any = fallback.translations;
        for (const p of parts) {
          if (fbValue && typeof fbValue === 'object' && p in fbValue) {
            fbValue = fbValue[p];
          } else {
            return key; // Return key as-is
          }
        }
        value = fbValue;
        break;
      }
    }

    if (typeof value !== 'string') return key;

    // Interpolate params
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match, param) => {
        return String(params[param] !== undefined ? params[param] : match);
      });
    }

    return value;
  }

  getAvailableLocales(): Array<{ locale: SupportedLocale; name: string; nativeName: string; direction: 'ltr' | 'rtl' }> {
    return Array.from(this.locales.values()).map(l => ({
      locale: l.locale,
      name: l.name,
      nativeName: l.nativeName,
      direction: l.direction
    }));
  }

  async loadLocaleFile(filePath: string): Promise<boolean> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const localeData: LocaleData = JSON.parse(data);
      this.locales.set(localeData.locale, localeData);
      logger.info(`[I18nManager] Loaded locale from file: ${localeData.locale}`);
      return true;
    } catch (err: any) {
      logger.warn(`[I18nManager] Failed to load locale file: ${err.message}`);
      return false;
    }
  }

  formatDate(date: Date, locale?: SupportedLocale): string {
    const l = this.locales.get(locale || this.currentLocale);
    if (!l) return date.toISOString();
    
    // Simple formatting - in production use Intl.DateTimeFormat
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    
    return l.dateFormat
      .replace('YYYY', String(y))
      .replace('MM', m)
      .replace('DD', d);
  }

  formatTime(date: Date, locale?: SupportedLocale): string {
    const l = this.locales.get(locale || this.currentLocale);
    if (!l) return date.toISOString();
    
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    
    return l.timeFormat
      .replace('HH', h)
      .replace('mm', m)
      .replace('ss', s);
  }

  getTextDirection(): 'ltr' | 'rtl' {
    const locale = this.locales.get(this.currentLocale);
    return locale?.direction || 'ltr';
  }
}

export const i18nManager = new I18nManager();
