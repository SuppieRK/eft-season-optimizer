import { ChevronDown, X, createElement as createIcon } from 'lucide';
import type { Catalogs } from './catalogs';
import type { Localizer } from './localization';
import { normalizePersonalRequirements, requirementSnapshot, validateRequirements, type PersonalRequirements } from './personal-requirements';
import { exportPlannerBackup, previewPlannerBackup, type BackupPreview } from './planner-backup';
import type { AppState } from './state';
import './requirements-editor.css';

interface EditorOptions {
  readonly catalogs: Catalogs;
  readonly localizer: Localizer;
  readonly getCatalogs: () => Catalogs;
  readonly getOverrides: () => PersonalRequirements;
  readonly getState: () => AppState;
  readonly onImport: (preview: BackupPreview, complete: boolean) => void;
  readonly onSave: (overrides: PersonalRequirements) => void;
}

type DraftRequirement = { documentId: string; quantity: number };

export function mountRequirementsEditor(options: EditorOptions): void {
  const { catalogs, localizer } = options;
  const text = (id: string) => localizer.text(id);
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', content = '') => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = content;
    return node;
  };
  const button = (label: string, action: () => void) => {
    const node = element('button', '', text(label));
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  };
  const trigger = button('requirements.edit', () => open());
  trigger.className = 'requirements-edit-trigger';
  const entryPoint = element('div', 'requirements-entry-point');
  const notice = element('p', 'requirements-notice', text('requirements.notice'));
  entryPoint.append(trigger, notice);
  document.querySelector('[data-reward-pages]')!.before(entryPoint);
  const dialog = element('dialog', 'requirements-dialog');
  dialog.setAttribute('aria-labelledby', 'requirements-editor-title');
  const header = element('header');
  const title = element('h2', '', text('requirements.edit'));
  title.id = 'requirements-editor-title';
  const close = button('ui.close', () => dialog.close());
  close.className = 'dialog-close';
  close.setAttribute('aria-label', text('ui.close'));
  close.replaceChildren(createIcon(X, { 'aria-hidden': 'true', class: 'dialog-close__icon' }));
  header.append(title, close);
  const form = element('form');
  form.noValidate = true;
  const content = element('div', 'requirements-editor-content');
  const error = element('p', 'requirements-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const footer = element('footer');
  const save = element('button', '', text('requirements.save'));
  save.type = 'submit';
  footer.append(save, button('ui.cancel', () => dialog.close()));
  form.append(content, error, footer);
  const toolbar = element('div', 'requirements-toolbar');
  const fileInput = element('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.hidden = true;
  fileInput.setAttribute('aria-label', text('requirements.import'));
  toolbar.append(button('requirements.import', () => fileInput.click()), button('requirements.export', () => {
    const blob = new Blob([exportPlannerBackup(options.getCatalogs(), options.getState())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = element('a');
    link.href = url;
    link.download = `eft-season-optimizer-${catalogs.battlePass.id}-backup.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }), fileInput);
  dialog.append(header, toolbar, form);
  document.body.append(dialog);
  const importDialog = element('dialog', 'requirements-dialog requirements-import-dialog');
  importDialog.setAttribute('aria-labelledby', 'requirements-import-title');
  const importTitle = element('h2', '', text('requirements.import'));
  importTitle.id = 'requirements-import-title';
  const importHeader = element('header');
  const importClose = button('ui.close', () => importDialog.close());
  importClose.className = 'dialog-close';
  importClose.setAttribute('aria-label', text('ui.close'));
  importClose.replaceChildren(createIcon(X, { 'aria-hidden': 'true', class: 'dialog-close__icon' }));
  importHeader.append(importTitle, importClose);
  const importContent = element('div', 'requirements-editor-content requirements-import-content');
  const importForm = element('form');
  const scopeOptions = element('fieldset', 'requirements-import-scopes');
  scopeOptions.append(element('legend', '', text('requirements.replaceScope')));
  const scopes = ['requirements.only', 'requirements.complete'] as const;
  const radios = scopes.map((id, index) => {
    const label = element('label');
    const radio = element('input');
    radio.type = 'radio';
    radio.name = 'requirements-import-scope';
    radio.value = index === 0 ? 'requirements' : 'complete';
    radio.checked = index === 0;
    label.append(radio, text(id));
    scopeOptions.append(label);
    return radio;
  });
  const previewCopy = element('p', '', text('requirements.replaceConfirm'));
  const adjustments = element('ul', 'requirements-adjustments');
  const importError = element('p', 'requirements-error');
  importError.setAttribute('role', 'alert');
  importError.hidden = true;
  importContent.append(previewCopy, scopeOptions, adjustments);
  const importFooter = element('footer');
  const replace = element('button', '', text('requirements.replace'));
  replace.type = 'submit';
  importFooter.append(replace, button('ui.cancel', () => importDialog.close()));
  importForm.append(importContent, importError, importFooter);
  importDialog.append(importHeader, importForm);
  document.body.append(importDialog);
  let preview: BackupPreview | undefined;
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    error.hidden = true;
    try {
      if (file.size > 2_000_000) throw new Error('requirements.invalidBackup');
      preview = previewPlannerBackup(await file.text(), catalogs);
      if (!dialog.open) return;
      adjustments.replaceChildren();
      for (const adjustment of preview.adjustments) {
        const translated = text(adjustment.id);
        const name = translated.startsWith('⟦missing:') ? adjustment.id : translated;
        const item = element('li', '', localizer.text(adjustment.kind, { name }));
        item.dataset.adjustmentKind = adjustment.kind;
        adjustments.append(item);
      }
      const updateAdjustments = () => {
        adjustments.querySelectorAll<HTMLElement>('[data-adjustment-kind="requirements.adjustedProgress"]').forEach((item) => {
          item.hidden = !radios[1].checked;
        });
      };
      radios.forEach((radio) => { radio.onchange = updateAdjustments; });
      radios[0].checked = true;
      updateAdjustments();
      importError.hidden = true;
      importDialog.showModal();
    } catch (cause) {
      error.textContent = text(cause instanceof Error && cause.message.startsWith('requirements.') ? cause.message : 'requirements.invalidBackup');
      error.hidden = false;
    }
  });
  importForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!preview) return;
    try {
      options.onImport(preview, radios[1].checked);
      importDialog.close();
      dialog.close();
    } catch (cause) {
      importError.textContent = text(cause instanceof Error && cause.message.startsWith('requirements.') ? cause.message : 'requirements.storageWriteError');
      importError.hidden = false;
    }
  });
  let draft: Record<string, DraftRequirement[]> = {};
  let preservedIds = new Set<string>();
  const regular = catalogs.documents.documents.filter((entry) => entry.kind === 'regular');

  const renderReward = (rewardId: string, container: HTMLElement) => {
    container.replaceChildren();
    const rewardHeading = element('div', 'requirements-reward-heading');
    rewardHeading.append(element('h3', '', text(rewardId)), button('requirements.restoreDefault', () => {
      preservedIds.delete(rewardId);
      draft[rewardId] = [...requirementSnapshot(catalogs)[rewardId]].map((entry) => ({ ...entry }));
      renderReward(rewardId, container);
    }));
    container.append(rewardHeading);
    const rows: { select: HTMLSelectElement; entry: DraftRequirement }[] = [];
    const refreshChoices = () => {
      rows.forEach(({ select, entry }) => {
        [...select.options].forEach((option) => {
          option.disabled = draft[rewardId].some((other) => other !== entry && other.documentId === option.value);
        });
      });
    };
    draft[rewardId].forEach((entry, index) => {
      const row = element('div', 'requirements-entry');
      const label = element('label');
      label.append(element('span', '', text('about.documentColumn')));
      const select = element('select');
      select.dataset.requirementDocument = '';
      regular.forEach((record) => select.add(new Option(text(record.id), record.id)));
      select.value = entry.documentId;
      select.addEventListener('change', () => {
        entry.documentId = select.value;
        refreshChoices();
      });
      const selectControl = element('span', 'requirements-select');
      selectControl.append(select, createIcon(ChevronDown, { 'aria-hidden': 'true', class: 'requirements-select-chevron' }));
      label.append(selectControl);
      const quantityLabel = element('label');
      quantityLabel.append(element('span', '', text('ui.quantity')));
      const quantity = element('input');
      quantity.type = 'number';
      quantity.min = '1';
      quantity.max = String(Number.MAX_SAFE_INTEGER);
      quantity.step = '1';
      quantity.required = true;
      quantity.value = String(entry.quantity);
      quantity.dataset.requirementQuantity = '';
      quantity.addEventListener('input', () => { entry.quantity = quantity.valueAsNumber; });
      quantityLabel.append(quantity);
      const remove = button('requirements.remove', () => {
        draft[rewardId].splice(index, 1);
        renderReward(rewardId, container);
      });
      remove.disabled = draft[rewardId].length === 1;
      row.append(label, quantityLabel, remove);
      container.append(row);
      rows.push({ select, entry });
    });
    refreshChoices();
    const add = button('requirements.add', () => {
      const record = regular.find((candidate) => !draft[rewardId].some((entry) => entry.documentId === candidate.id));
      if (!record) return;
      draft[rewardId].push({ documentId: record.id, quantity: 1 });
      renderReward(rewardId, container);
    });
    add.disabled = draft[rewardId].length >= regular.length;
    container.append(add);
  };

  const open = () => {
    preservedIds = new Set(Object.keys(options.getOverrides()));
    draft = Object.fromEntries(Object.entries(requirementSnapshot(options.getCatalogs())).map(([id, entries]) =>
      [id, entries.map((entry) => ({ ...entry }))]));
    content.replaceChildren();
    error.hidden = true;
    catalogs.battlePass.pages.forEach((page) => {
      const section = element('details');
      section.append(element('summary', '', `${text('battlePass.page')} ${String(page.page).padStart(2, '0')}`));
      page.rewards.forEach((reward) => {
        const container = element('section', 'requirements-reward');
        container.dataset.editReward = reward.id;
        renderReward(reward.id, container);
        section.append(container);
      });
      content.append(section);
    });
    dialog.showModal();
    content.scrollTop = 0;
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      for (const [id, entries] of Object.entries(draft)) {
        try {
          validateRequirements(entries, catalogs);
        } catch (cause) {
          const reward = content.querySelector<HTMLElement>(`[data-edit-reward="${CSS.escape(id)}"]`);
          const page = reward?.closest('details');
          if (page) page.open = true;
          reward?.scrollIntoView({ block: 'nearest' });
          throw cause;
        }
      }
      options.onSave(normalizePersonalRequirements(draft, catalogs, preservedIds));
      dialog.close();
    } catch (cause) {
      error.textContent = text(cause instanceof Error && cause.message.startsWith('requirements.') ? cause.message : 'requirements.storageWriteError');
      error.hidden = false;
    }
  });
}
