import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AllergyService } from '../../../../core/services/allergy.service';
import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-allergy-onboarding',
  templateUrl: './allergy-onboarding.page.html',
  styleUrls: ['./allergy-onboarding.page.scss'],
  standalone: false,
})
export class AllergyOnboardingPage implements OnInit {
  allergyOptions: any[] = [];
  isLoading = true;

  constructor(
    private router: Router,
    private allergyService: AllergyService,
    private userService: UserService,
    private authService: AuthService,
    private toastController: ToastController
  ) { }

  ngOnInit() {
    // TEMPORARILY DISABLED: Check if user is logged in
    // const currentUser = this.authService.getCurrentUser();
    // if (!currentUser) {
    //   this.router.navigate(['/login']);
    //   return;
    // }
    
    this.loadAllergyOptions();
  }

  async loadAllergyOptions() {
    try {
      this.isLoading = true;
      
      // Load allergy options from Firebase
      let options = await this.allergyService.getAllergyOptions();
      
      console.log('Loaded options from Firebase:', options);
      
      // If no options exist in Firebase, show empty state
      if (!options || options.length === 0) {
        console.log('No options in Firebase, showing empty state');
        this.allergyOptions = [];
        return;
      }
      
      // Wait for auth to be initialized
      const currentUser = await this.authService.waitForAuthInit();
      const userId = currentUser ? currentUser.uid : 'test-user-123';
      
      console.log('Loading allergy onboarding for user:', currentUser?.email || 'no user'); // Debug log
      
      // Get user's existing allergy data (if any)
      const userAllergies = await this.allergyService.getUserAllergies(userId);
      console.log('Loaded user allergies:', userAllergies);
      
      if (userAllergies && userAllergies.length > 0) {
        // User has existing allergy data - merge with options
        const userAllergiesData = userAllergies[0].allergies || [];
        
        // Create a map for quick lookup of user's allergies by name
        const userAllergiesMap = new Map();
        userAllergiesData.forEach((allergy: any) => {
          userAllergiesMap.set(allergy.name, allergy);
        });
        
        // Merge options with user data
        this.allergyOptions = options.map(option => {
          const userAllergy = userAllergiesMap.get(option.name);
          return {
            ...option,
            // Use existing checked status if available, otherwise default to false
            checked: userAllergy ? userAllergy.checked : false,
            // Use existing value if available, otherwise default to empty string for inputs
            value: userAllergy?.value || (option.hasInput ? '' : undefined),
            label: userAllergy?.customValue || option.label
          };
        });
        
        console.log('Merged allergies with user data:', this.allergyOptions);
      } else {
        // No existing user data - initialize with defaults
        this.allergyOptions = options.map(option => ({
          ...option,
          checked: false,
          value: option.hasInput ? '' : undefined
        }));
      }
      
    } catch (error) {
      console.error('Error loading allergy options:', error);
      this.allergyOptions = [];
    } finally {
      this.isLoading = false;
    }
  }



  async submitAllergies() {
    // Check if any allergies are selected
    const hasSelectedAllergies = this.allergyOptions.some(allergy => allergy.checked);
    
    if (!hasSelectedAllergies) {
      const toast = await this.toastController.create({
        message: 'Please select at least one allergy or tap "No Allergies"',
        duration: 3000,
        color: 'warning'
      });
      await toast.present();
      return;
    }

    try {
      // Wait for auth to be initialized
      const currentUser = await this.authService.waitForAuthInit();
      
      // First, save allergies (reusing the saveAllergies method)
      await this.saveAllergies();
      
      // Mark allergy onboarding as completed (only if user is logged in)
      if (currentUser) {
        await this.userService.markAllergyOnboardingCompleted(currentUser.uid);
      }
      
      // Navigate to main app
      this.router.navigate(['/tabs/home']);
      
    } catch (error) {
      console.error('Error during submission:', error);
      const toast = await this.toastController.create({
        message: 'Failed to complete the process. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  // Save allergies to Firebase for the current user
  async saveAllergies() {
    try {
      // Wait for auth to be initialized
      const currentUser = await this.authService.waitForAuthInit();
      const userId = currentUser ? currentUser.uid : 'test-user-123';
      
      console.log('Saving allergies for user:', currentUser?.email || 'no user'); // Debug log
      
      // Prepare allergies for Firebase - ensure no undefined values
      const sanitizedAllergies = this.allergyOptions
      .filter(allergy => allergy.checked)
      .map(allergy => {
        // Create a clean copy without undefined values
        const cleanAllergy: Record<string, any> = {
          id: allergy.id,
          name: allergy.name,
          label: allergy.label,
          checked: allergy.checked,
          order: allergy.order,
          hasInput: allergy.hasInput
        };
        
        // Only include input value if it's not empty
       if (allergy.hasInput) {
        const inputValue = allergy.value?.trim();

       if (inputValue) {
          cleanAllergy['customValue'] = inputValue;

      // Replace "Others" label with user input
        cleanAllergy['label'] = inputValue;
  }
}
        return cleanAllergy;
      });
      
      // Check if user already has allergy data
      const userAllergies = await this.allergyService.getUserAllergies(userId);
      
      if (userAllergies && userAllergies.length > 0) {
        // User has existing allergy data - update it
        const allergyDocId = userAllergies[0].id;
        await this.allergyService.updateUserAllergies(allergyDocId, sanitizedAllergies);
        console.log('Updated user allergies');
      } else {
        // No existing data - create new record
        await this.allergyService.addUserAllergies(userId, sanitizedAllergies);
        console.log('Created new user allergies record');
      }
      
      // Show success toast
      const toast = await this.toastController.create({
        message: 'Allergies saved successfully!',
        duration: 2000,
        color: 'success'
      });
      await toast.present();
      
    } catch (error) {
      console.error('Error saving allergies:', error);
      const toast = await this.toastController.create({
        message: 'Failed to save allergies. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }
}






