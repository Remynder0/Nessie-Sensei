import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import i18n from '../i18n';

export const startTutorial = (force = false) => {
  // If not forced, check if already completed
  if (!force && localStorage.getItem('tutorialCompleted')) {
    return;
  }

  // Helper to get translated string
  const t = (key: string) => i18n.global.t(key);

  const driverObj = driver({
    showProgress: false,
    animate: true,
    overlayColor: 'rgba(0, 0, 0, 0.8)',
    nextBtnText: t('tutorial.nextBtn'),
    prevBtnText: t('tutorial.prevBtn'),
    doneBtnText: t('tutorial.doneBtn'),
    onDestroyStarted: () => {
      if (!driverObj.hasNextStep() || confirm("Passer le tutoriel ?")) {
        localStorage.setItem('tutorialCompleted', 'true');
        driverObj.destroy();
      }
    },
    steps: [
      {
        popover: {
          title: t('tutorial.step1_title'),
          description: t('tutorial.step1_desc'),
          onNextClick: () => {
            document.getElementById('nav-TeamGen')?.click();
            setTimeout(() => driverObj.moveNext(), 150);
          }
        }
      },
      {
        element: '#tour-teamgen-format',
        popover: {
          title: t('tutorial.step_team_format_title'),
          description: t('tutorial.step_team_format_desc'),
          side: "bottom",
          align: 'start'
        }
      },
      {
        element: '#tour-teamgen-profile',
        popover: {
          title: t('tutorial.step_team_profile_title'),
          description: t('tutorial.step_team_profile_desc'),
          side: "top",
          align: 'start'
        }
      },
      {
        element: '#tour-teamgen-save',
        popover: {
          title: t('tutorial.step_team_save_title'),
          description: t('tutorial.step_team_save_desc'),
          side: "left",
          align: 'center',
          onNextClick: () => {
            document.getElementById('nav-PackCalculator')?.click();
            setTimeout(() => driverObj.moveNext(), 150);
          }
        }
      },
      {
        element: '#tour-pack-input',
        popover: {
          title: t('tutorial.step_pack_level_title'),
          description: t('tutorial.step_pack_level_desc'),
          side: "right",
          align: 'start',
          onPrevClick: () => {
            document.getElementById('nav-TeamGen')?.click();
            setTimeout(() => driverObj.movePrevious(), 150);
          }
        }
      },
      {
        element: '#tour-pack-seasons',
        popover: {
          title: t('tutorial.step_pack_seasons_title'),
          description: t('tutorial.step_pack_seasons_desc'),
          side: "left",
          align: 'start',
          onNextClick: () => {
            document.getElementById('nav-Probabilities')?.click();
            setTimeout(() => {
                const select = document.getElementById('prob-select-input') as HTMLSelectElement;
                if (select) {
                    select.value = 'Pathfinder';
                    select.dispatchEvent(new Event('change'));
                }
                driverObj.moveNext();
            }, 150);
          }
        }
      },
      {
        element: '#tour-prob-results',
        popover: {
          title: t('tutorial.step_prob_title'),
          description: t('tutorial.step_prob_desc'),
          side: "top",
          align: 'start',
          onPrevClick: () => {
            document.getElementById('nav-PackCalculator')?.click();
            setTimeout(() => driverObj.movePrevious(), 150);
          }
        }
      },
      {
        element: '#tour-feedback',
        popover: {
          title: t('tutorial.step_feedback_title'),
          description: t('tutorial.step_feedback_desc'),
          side: "left",
          align: 'end'
        }
      }
    ]
  });

  driverObj.drive();
};
