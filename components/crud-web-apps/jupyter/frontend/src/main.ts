import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

async function bootstrap() {
  if (!environment.production) {
    await import('@angular/compiler');
  }

  return platformBrowserDynamic().bootstrapModule(AppModule);
}

bootstrap().catch(err => console.error(err));
