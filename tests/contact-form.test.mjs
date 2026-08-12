import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { compileScript, parse } from '@vue/compiler-sfc';
import { createRenderer, nextTick } from 'vue';

const componentUrl = new URL('../src/components/ContactForm.vue', import.meta.url);
const componentPath = fileURLToPath(componentUrl);

async function loadContactComponent(config) {
  const source = await readFile(componentUrl, 'utf8');
  const { descriptor, errors } = parse(source, { filename: componentPath });
  assert.deepEqual(errors, []);

  const compiled = compileScript(descriptor, { id: 'contact-form-test' });
  const replacements = new Map([
    ['PUBLIC_EMAILJS_PUBLIC_KEY', config.publicKey],
    ['PUBLIC_EMAILJS_SERVICE_ID', config.serviceId],
    ['PUBLIC_EMAILJS_TEMPLATE_ID', config.templateId],
    ['PUBLIC_EMAILJS_TO_EMAIL', config.toEmail],
  ]);
  let generated = compiled.content
    .replace(/interface FormData \{[\s\S]*?\}\n/, '')
    .replace(/ref<FormData>/g, 'ref')
    .replace(/ref<'success' \| 'error'>/g, 'ref');

  for (const [name, value] of replacements) {
    generated = generated.replaceAll(`import.meta.env.${name}`, JSON.stringify(value));
  }

  const generatedPath = join(dirname(componentPath), `.contact-form-test-${process.pid}-${Date.now()}.mjs`);
  try {
    await writeFile(generatedPath, generated, 'utf8');
    const component = (await import(pathToFileURL(generatedPath).href)).default;
    component.render = () => null;
    return component;
  } finally {
    await unlink(generatedPath).catch(() => {});
  }
}

function createTestRenderer() {
  return createRenderer({
    patchProp() {},
    insert() {},
    remove() {},
    createElement: (type) => ({ type }),
    createText: (text) => ({ text }),
    createComment: (text) => ({ text }),
    setText() {},
    setElementText() {},
    parentNode: () => null,
    nextSibling: () => null,
    querySelector: () => null,
    setScopeId() {},
    insertStaticContent: () => [{}, {}],
  });
}

async function withEmailSend(send, callback) {
  const emailjs = (await import('@emailjs/browser')).default;
  const descriptor = Object.getOwnPropertyDescriptor(emailjs, 'send');
  Object.defineProperty(emailjs, 'send', { configurable: true, value: send });

  try {
    await callback();
  } finally {
    Object.defineProperty(emailjs, 'send', descriptor);
  }
}

test('rejects contact submission when required EmailJS configuration is missing', async () => {
  const component = await loadContactComponent({
    publicKey: '',
    serviceId: '',
    templateId: '',
    toEmail: '',
  });
  const renderer = createTestRenderer();
  let sendCalled = false;

  await withEmailSend(async () => { sendCalled = true; }, async () => {
    const app = renderer.createApp(component);
    try {
      app.mount({});
      await nextTick();
      const state = app._instance.setupState;
      await state.handleSubmit();

      assert.equal(sendCalled, false);
      assert.equal(state.isSubmitting, false);
      assert.equal(state.statusType, 'error');
      assert.equal(state.statusMessage, 'EmailJS is not configured. Please set variables.');
    } finally {
      app.unmount();
    }
  });
});

test('submits exact contact fields and clears the form after success', async () => {
  const component = await loadContactComponent({
    publicKey: 'public_fixture_key',
    serviceId: 'service_fixture',
    templateId: 'template_fixture',
    toEmail: 'support@rl-labs.org',
  });
  const renderer = createTestRenderer();
  let resolveSend;
  let markSendStarted;
  let sendArguments;
  const sendStarted = new Promise((resolve) => { markSendStarted = resolve; });

  await withEmailSend((...args) => {
    sendArguments = args;
    markSendStarted();
    return new Promise((resolve) => { resolveSend = resolve; });
  }, async () => {
    const app = renderer.createApp(component);
    try {
      app.mount({});
      await nextTick();
      const state = app._instance.setupState;
      state.formData = {
        name: 'Ada Relay',
        email: 'ada@example.com',
        subject: 'Signal test',
        message: 'The relay is clear.',
      };

      const submission = state.handleSubmit();
      assert.equal(state.isSubmitting, true);
      await sendStarted;
      assert.deepEqual(sendArguments, [
        'service_fixture',
        'template_fixture',
        {
          to_email: 'support@rl-labs.org',
          from_name: 'Ada Relay',
          from_email: 'ada@example.com',
          subject: 'Signal test',
          message: 'The relay is clear.',
          reply_to: 'ada@example.com',
        },
      ]);

      resolveSend();
      await submission;

      assert.equal(state.isSubmitting, false);
      assert.equal(state.statusType, 'success');
      assert.equal(state.statusMessage, 'Thank you! Your message has been sent successfully.');
      assert.deepEqual(state.formData, { name: '', email: '', subject: '', message: '' });
    } finally {
      app.unmount();
    }
  });
});
