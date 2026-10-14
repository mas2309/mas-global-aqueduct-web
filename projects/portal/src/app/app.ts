import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'aq-root',
  imports: [RouterOutlet],
  template: `
    <header class="brand-bar">
      <span class="brand-mark" aria-hidden="true"></span>
      <span>MAS Acueductos</span>
    </header>
    <router-outlet />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
