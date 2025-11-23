<template>
  <nav class="navbar">
    <div class="container">
      <div class="nav-brand">
        <a href="/">
          <h1>R&L Labs, LLC</h1>
        </a>
      </div>
      <ul :class="['nav-menu', { active: isMenuOpen }]">
        <li><a href="/" :class="{ active: currentPath === '/' }">Home</a></li>
        <li><a href="/projects" :class="{ active: currentPath === '/projects' }">Projects</a></li>
        <li><a href="/contact" :class="{ active: currentPath === '/contact' }">Contact</a></li>
      </ul>
      <div class="hamburger" @click="toggleMenu">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const props = defineProps<{
  currentPath?: string;
}>();

const isMenuOpen = ref(false);

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

onMounted(() => {
  // Close menu when clicking on a link
  const navLinks = document.querySelectorAll('.nav-menu a');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      isMenuOpen.value = false;
    });
  });
});
</script>

