// Mobile Navigation Toggle
document.addEventListener('DOMContentLoaded', function() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
        
        // Close menu when clicking on a link
        const navLinks = document.querySelectorAll('.nav-menu a');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('active');
            });
        });
    }
    
    // Contact Form Handling with EmailJS
    const contactForm = document.getElementById('contactForm');
    const formStatus = document.getElementById('form-status');
    
    // EmailJS Configuration - Get from window.emailjsConfig (set in js/config.js)
    const EMAILJS_PUBLIC_KEY = window.emailjsConfig?.PUBLIC_KEY || 'YOUR_PUBLIC_KEY';
    const EMAILJS_SERVICE_ID = window.emailjsConfig?.SERVICE_ID || 'YOUR_SERVICE_ID';
    const EMAILJS_TEMPLATE_ID = window.emailjsConfig?.TEMPLATE_ID || 'YOUR_TEMPLATE_ID';
    
    // Initialize EmailJS
    if (typeof emailjs !== 'undefined') {
        emailjs.init(EMAILJS_PUBLIC_KEY);
    }
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Show loading state
            const submitButton = contactForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = 'Sending...';
            
            if (formStatus) {
                formStatus.textContent = '';
                formStatus.className = 'form-status';
            }
            
            // Get form values
            const formData = {
                from_name: document.getElementById('name').value,
                from_email: document.getElementById('email').value,
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value
            };
            
            // Check if EmailJS is loaded and configured
            if (typeof emailjs === 'undefined') {
                if (formStatus) {
                    formStatus.textContent = 'EmailJS library not loaded. Please check your configuration.';
                    formStatus.className = 'form-status error';
                }
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
                return;
            }
            
            if (EMAILJS_PUBLIC_KEY === 'YOUR_PUBLIC_KEY' || 
                EMAILJS_SERVICE_ID === 'YOUR_SERVICE_ID' || 
                EMAILJS_TEMPLATE_ID === 'YOUR_TEMPLATE_ID') {
                if (formStatus) {
                    formStatus.textContent = 'Please configure EmailJS with your credentials in js/main.js';
                    formStatus.className = 'form-status error';
                }
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
                return;
            }
            
            // Send email using EmailJS
            emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, formData)
                .then(function(response) {
                    if (formStatus) {
                        formStatus.textContent = 'Thank you! Your message has been sent successfully.';
                        formStatus.className = 'form-status success';
                    }
                    contactForm.reset();
                })
                .catch(function(error) {
                    if (formStatus) {
                        formStatus.textContent = 'There was an error sending your message. Please try again or contact us directly at support@rl-labs.org';
                        formStatus.className = 'form-status error';
                    } else {
                        alert('Error: There was an error sending your message. Please try again.');
                    }
                    console.error('EmailJS Error:', error);
                })
                .finally(function() {
                    submitButton.disabled = false;
                    submitButton.textContent = originalButtonText;
                });
        });
    }
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

