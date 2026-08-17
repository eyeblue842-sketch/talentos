"use client";

// Singleton loader for Razorpay's Standard Checkout script. Guarantees the
// <script> tag is injected at most once regardless of how many
// RazorpayCheckoutButton instances mount/unmount (section 12: "Do not
// inject the Razorpay script multiple times").
let loaderPromise = null;

export function loadRazorpayCheckout() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay checkout can only be loaded in the browser.'));
  }
  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }
  if (loaderPromise) {
    return loaderPromise;
  }

  loaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-razorpay-checkout]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Razorpay));
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay checkout script.')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error('Failed to load Razorpay checkout script.'));
    };
    document.body.appendChild(script);
  });

  return loaderPromise;
}
