<template>
  <form class="contact-form" @submit.prevent="handleSubmit">
    <div class="form-group">
      <label for="name">Name</label>
      <input 
        type="text" 
        id="name" 
        v-model="formData.name" 
        required 
      />
    </div>
    <div class="form-group">
      <label for="email">Email</label>
      <input 
        type="email" 
        id="email" 
        v-model="formData.email" 
        required 
      />
    </div>
    <div class="form-group">
      <label for="subject">Subject</label>
      <input 
        type="text" 
        id="subject" 
        v-model="formData.subject" 
        required 
      />
    </div>
    <div class="form-group">
      <label for="message">Message</label>
      <textarea 
        id="message" 
        v-model="formData.message" 
        rows="5" 
        required
      ></textarea>
    </div>
    <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
      {{ isSubmitting ? 'Sending...' : 'Send Message' }}
    </button>
    <div v-if="statusMessage" :class="['form-status', statusType]">
      {{ statusMessage }}
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface FormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const formData = ref<FormData>({
  name: '',
  email: '',
  subject: '',
  message: ''
});

const isSubmitting = ref(false);
const statusMessage = ref('');
const statusType = ref<'success' | 'error'>('success');

// Get EmailJS config from environment variables
const emailjsConfig = {
  PUBLIC_KEY: import.meta.env.PUBLIC_EMAILJS_PUBLIC_KEY || '',
  SERVICE_ID: import.meta.env.PUBLIC_EMAILJS_SERVICE_ID || '',
  TEMPLATE_ID: import.meta.env.PUBLIC_EMAILJS_TEMPLATE_ID || '',
  TO_EMAIL: import.meta.env.PUBLIC_EMAILJS_TO_EMAIL || 'rllabsadmin@rl-labs.org'
};

onMounted(async () => {
  // Dynamically import EmailJS (browser-only)
  if (typeof window !== 'undefined') {
    const emailjs = (await import('@emailjs/browser')).default;
    // Initialize EmailJS
    if (emailjsConfig.PUBLIC_KEY) {
      emailjs.init(emailjsConfig.PUBLIC_KEY);
    }
  }
});

const handleSubmit = async () => {
  if (!emailjsConfig.PUBLIC_KEY || !emailjsConfig.SERVICE_ID || !emailjsConfig.TEMPLATE_ID) {
    statusMessage.value = 'EmailJS is not configured. Please set variables.';
    statusType.value = 'error';
    return;
  }

  isSubmitting.value = true;
  statusMessage.value = '';

  try {
    // Dynamically import EmailJS
    const emailjs = (await import('@emailjs/browser')).default;
    
    const templateParams = {
      to_email: emailjsConfig.TO_EMAIL,
      from_name: formData.value.name,
      from_email: formData.value.email,
      subject: formData.value.subject,
      message: formData.value.message,
      reply_to: formData.value.email
    };

    await emailjs.send(
      emailjsConfig.SERVICE_ID,
      emailjsConfig.TEMPLATE_ID,
      templateParams
    );

    statusMessage.value = 'Thank you! Your message has been sent successfully.';
    statusType.value = 'success';
    formData.value = { name: '', email: '', subject: '', message: '' };
  } catch (error) {
    console.error('EmailJS Error:', error);
    statusMessage.value = 'There was an error sending your message. Please try again or contact us directly at rllabsadmin@rl-labs.org';
    statusType.value = 'error';
  } finally {
    isSubmitting.value = false;
  }
};
</script>

