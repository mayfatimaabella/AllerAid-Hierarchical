import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { MedicalHistory, EHRService } from '../../../../../core/services/ehr.service';

@Component({
  selector: 'app-medical-history-details',
  templateUrl: './medical-history-details.page.html',
  styleUrls: ['./medical-history-details.page.scss'],
  standalone: false,
})
export class MedicalHistoryDetailsPage implements OnInit {

  history: MedicalHistory | null = null;

  constructor(
    private navCtrl: NavController,
    private route: ActivatedRoute,
    private ehrService: EHRService
  ) { }

  ngOnInit() {
    // Get the medical history ID from route parameters
    this.route.params.subscribe(async params => {
      if (params['id']) {
        try {
          console.log('Loading medical history with ID:', params['id']);
          this.history = await this.ehrService.getMedicalHistoryById(params['id']);
          console.log('Medical history details loaded:', this.history);
        } catch (error) {
          console.error('Error loading medical history data:', error);
          this.history = null;
        }
      }
    });
  }

  goBack() {
    this.navCtrl.back();
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'danger';
      case 'resolved': return 'success';
      case 'chronic': return 'warning';
      case 'not-cured': return 'dark';
      default: return 'medium';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'active': return 'Active';
      case 'resolved': return 'Resolved';
      case 'chronic': return 'Chronic';
      case 'not-cured': return 'Not Cured';
      default: return status;
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'active': return 'alert-circle';
      case 'resolved': return 'checkmark-circle';
      case 'chronic': return 'time';
      case 'not-cured': return 'close-circle';
      default: return 'help-circle';
    }
  }

  getTimeSinceDiagnosis(): string {
    if (!this.history?.diagnosisDate) return '';
    
    try {
      const dateValue = this.history.diagnosisDate as any;
      let diagnosisDate: Date;
      
      // Convert to Date object using the same logic as getDiagnosisDateString
      if (typeof dateValue === 'string') {
        diagnosisDate = new Date(dateValue);
      } else if (dateValue instanceof Date) {
        diagnosisDate = dateValue;
      } else if (typeof dateValue === 'object' && dateValue !== null) {
        if (dateValue.seconds) {
          diagnosisDate = new Date(dateValue.seconds * 1000);
        } else if (dateValue.toDate && typeof dateValue.toDate === 'function') {
          diagnosisDate = dateValue.toDate();
        } else if (dateValue._seconds) {
          diagnosisDate = new Date(dateValue._seconds * 1000);
        } else {
          return '';
        }
      } else {
        return '';
      }
      
      if (isNaN(diagnosisDate.getTime())) {
        return '';
      }
      
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - diagnosisDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 30) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months !== 1 ? 's' : ''} ago`;
      } else {
        const years = Math.floor(diffDays / 365);
        return `${years} year${years !== 1 ? 's' : ''} ago`;
      }
    } catch (error) {
      console.error('Error calculating time since diagnosis:', error);
      return '';
    }
  }

  getDiagnosisDateString(): string {
    if (!this.history?.diagnosisDate) return '';
    
    try {
      const dateValue = this.history.diagnosisDate as any;
      console.log('Raw date value:', dateValue, 'Type:', typeof dateValue);
      
      // Handle string dates
      if (typeof dateValue === 'string') {
        // Validate that it's a valid date string
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          return dateValue;
        }
      }
      
      // Handle Date objects
      if (dateValue instanceof Date) {
        if (!isNaN(dateValue.getTime())) {
          return dateValue.toISOString();
        }
      }
      
      // Handle Firestore timestamp format
      if (typeof dateValue === 'object' && dateValue !== null) {
        if (dateValue.seconds) {
          return new Date(dateValue.seconds * 1000).toISOString();
        }
        if (dateValue.toDate && typeof dateValue.toDate === 'function') {
          return dateValue.toDate().toISOString();
        }
        // Handle other timestamp formats
        if (dateValue._seconds) {
          return new Date(dateValue._seconds * 1000).toISOString();
        }
      }
      
      console.warn('Unable to parse date value:', dateValue);
      return '';
    } catch (error) {
      console.error('Error parsing date:', error, this.history.diagnosisDate);
      return '';
    }
  }

  getFormattedDiagnosisDate(): string {
    if (!this.history?.diagnosisDate) return 'Date not available';
    
    try {
      const dateValue = this.history.diagnosisDate as any;
      let diagnosisDate: Date;
      
      // Convert to Date object using the same logic
      if (typeof dateValue === 'string') {
        diagnosisDate = new Date(dateValue);
      } else if (dateValue instanceof Date) {
        diagnosisDate = dateValue;
      } else if (typeof dateValue === 'object' && dateValue !== null) {
        if (dateValue.seconds) {
          diagnosisDate = new Date(dateValue.seconds * 1000);
        } else if (dateValue.toDate && typeof dateValue.toDate === 'function') {
          diagnosisDate = dateValue.toDate();
        } else if (dateValue._seconds) {
          diagnosisDate = new Date(dateValue._seconds * 1000);
        } else {
          return 'Invalid date format';
        }
      } else {
        return 'Invalid date format';
      }
      
      if (isNaN(diagnosisDate.getTime())) {
        return 'Invalid date';
      }
      
      // Format the date manually to avoid pipe issues
      return diagnosisDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting diagnosis date:', error);
      return 'Date formatting error';
    }
  }

  getFormattedCreatedAt(): string {
    if (!this.history?.createdAt) return 'Not available';
    
    try {
      const dateValue = this.history.createdAt as any;
      let createdDate: Date;
      
      if (typeof dateValue === 'string') {
        createdDate = new Date(dateValue);
      } else if (dateValue instanceof Date) {
        createdDate = dateValue;
      } else if (typeof dateValue === 'object' && dateValue !== null) {
        if (dateValue.seconds) {
          createdDate = new Date(dateValue.seconds * 1000);
        } else if (dateValue.toDate && typeof dateValue.toDate === 'function') {
          createdDate = dateValue.toDate();
        } else if (dateValue._seconds) {
          createdDate = new Date(dateValue._seconds * 1000);
        } else {
          return 'Invalid date format';
        }
      } else {
        return 'Invalid date format';
      }
      
      if (isNaN(createdDate.getTime())) {
        return 'Invalid date';
      }
      
      return createdDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting created date:', error);
      return 'Date formatting error';
    }
  }

  getFormattedUpdatedAt(): string {
    if (!this.history?.updatedAt) return 'Not available';
    
    try {
      const dateValue = this.history.updatedAt as any;
      let updatedDate: Date;
      
      if (typeof dateValue === 'string') {
        updatedDate = new Date(dateValue);
      } else if (dateValue instanceof Date) {
        updatedDate = dateValue;
      } else if (typeof dateValue === 'object' && dateValue !== null) {
        if (dateValue.seconds) {
          updatedDate = new Date(dateValue.seconds * 1000);
        } else if (dateValue.toDate && typeof dateValue.toDate === 'function') {
          updatedDate = dateValue.toDate();
        } else if (dateValue._seconds) {
          updatedDate = new Date(dateValue._seconds * 1000);
        } else {
          return 'Invalid date format';
        }
      } else {
        return 'Invalid date format';
      }
      
      if (isNaN(updatedDate.getTime())) {
        return 'Invalid date';
      }
      
      return updatedDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting updated date:', error);
      return 'Date formatting error';
    }
  }

}
