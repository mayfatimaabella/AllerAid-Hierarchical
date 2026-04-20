// Test script to run in browser console
// This will show the route map without needing emergency

// Test data - Manila coordinates
const testRouteData = {
  origin: { lat: 14.5995, lng: 120.9842 }, // Makati
  destination: { lat: 14.6042, lng: 120.9822 }, // BGC
  buddyName: 'Test Buddy',
  patientName: 'Test Patient'
};

const testEmergencyId = 'test-emergency-' + Date.now();
const testBuddyId = 'test-buddy-' + Date.now();

// Function to show route map (paste this in browser console)
async function showTestRouteMap() {
  try {
    // Get Angular app reference
    const app = window.ng;
    if (!app) {
      console.error('Angular app not found. Make sure you are on the AllerAid page.');
      return;
    }

    console.log('Creating test route map...');
    console.log('Route data:', testRouteData);
    console.log('Emergency ID:', testEmergencyId);
    console.log('Buddy ID:', testBuddyId);

    // This will show the test data in console
    // The actual map component can be accessed through Angular's component system
    
    alert('Test data ready! Check console for coordinates. Navigate to a buddy page and click "I\'m on my way" to see the live map.');
    
  } catch (error) {
    console.error('Error showing test map:', error);
  }
}

// Auto-run when script loads
showTestRouteMap();