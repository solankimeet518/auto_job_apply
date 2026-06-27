import prompts from 'prompts';
import fs from 'fs';
import path from 'path';

/**
 * CLI Profile Editor loop. Allows interactive editing of the structured profile data.
 * @param {object} profile - The initially extracted profile object.
 * @returns {Promise<object>} - The verified and edited profile object.
 */
export async function editProfile(profile) {
  let running = true;
  let currentProfile = { ...profile };

  // Make sure nested structures exist
  currentProfile.links = currentProfile.links || { github: '', linkedin: '', twitter: '', portfolio: '' };
  currentProfile.skills = currentProfile.skills || [];
  currentProfile.experience = currentProfile.experience || [];
  currentProfile.education = currentProfile.education || [];

  console.log("\n=============================================");
  console.log("   📝 RESUME EXTRACTED PROFILE SUMMARY       ");
  console.log("=============================================");

  while (running) {
    printProfileOverview(currentProfile);

    const action = await prompts({
      type: 'select',
      name: 'choice',
      message: 'Select what you would like to edit or proceed:',
      choices: [
        { title: '🔍 View Full Profile Detail', value: 'view' },
        { title: '👤 Edit Basic Info (Name, Email, Phone, Location)', value: 'basic' },
        { title: '🔗 Edit Profile Links (GitHub, LinkedIn, Twitter, Portfolio)', value: 'links' },
        { title: '📄 Edit Profile Summary', value: 'summary' },
        { title: '⚡ Edit Skills', value: 'skills' },
        { title: '💼 Edit Experience', value: 'experience' },
        { title: '🎓 Edit Education', value: 'education' },
        { title: '🎯 Edit Target Job Title & Location', value: 'target' },
        { title: '🔄 Re-upload & Update Resume PDF', value: 'reupload' },
        { title: '✅ Confirmed & Save (Proceed)', value: 'save' },
        { title: '❌ Exit Without Saving', value: 'exit' }
      ]
    });

    if (!action.choice || action.choice === 'exit') {
      console.log('Exiting without saving profile.');
      process.exit(0);
    }

    switch (action.choice) {
      case 'view':
        console.log("\n--- Full Profile Details ---");
        console.log(JSON.stringify(currentProfile, null, 2));
        console.log("----------------------------");
        await prompts({
          type: 'text',
          name: 'any',
          message: 'Press Enter to return to menu...'
        });
        break;

      case 'basic': {
        const edits = await prompts([
          {
            type: 'text',
            name: 'name',
            message: 'Name:',
            initial: currentProfile.name
          },
          {
            type: 'text',
            name: 'email',
            message: 'Email:',
            initial: currentProfile.email
          },
          {
            type: 'text',
            name: 'phone',
            message: 'Phone:',
            initial: currentProfile.phone
          },
          {
            type: 'text',
            name: 'location',
            message: 'Location:',
            initial: currentProfile.location
          }
        ]);
        if (edits.name !== undefined) {
          currentProfile = { ...currentProfile, ...edits };
        }
        break;
      }

      case 'links': {
        const edits = await prompts([
          {
            type: 'text',
            name: 'github',
            message: 'GitHub Profile Link:',
            initial: currentProfile.links.github
          },
          {
            type: 'text',
            name: 'linkedin',
            message: 'LinkedIn Profile Link:',
            initial: currentProfile.links.linkedin
          },
          {
            type: 'text',
            name: 'twitter',
            message: 'Twitter Profile Link:',
            initial: currentProfile.links.twitter
          },
          {
            type: 'text',
            name: 'portfolio',
            message: 'Portfolio / Website:',
            initial: currentProfile.links.portfolio
          }
        ]);
        if (edits.github !== undefined) {
          currentProfile.links = edits;
        }
        break;
      }

      case 'summary': {
        const edit = await prompts({
          type: 'text',
          name: 'summary',
          message: 'Profile Summary:',
          initial: currentProfile.summary
        });
        if (edit.summary !== undefined) {
          currentProfile.summary = edit.summary;
        }
        break;
      }

      case 'skills': {
        const edit = await prompts({
          type: 'text',
          name: 'skillsStr',
          message: 'Skills (comma-separated):',
          initial: currentProfile.skills.join(', ')
        });
        if (edit.skillsStr !== undefined) {
          currentProfile.skills = edit.skillsStr
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
        }
        break;
      }

      case 'experience': {
        console.log('\n--- Experience Editor ---');
        // Let user choose to edit existing or add new
        const choices = currentProfile.experience.map((exp, idx) => ({
          title: `Edit: ${exp.role} at ${exp.company}`,
          value: { action: 'edit', index: idx }
        }));
        choices.push({ title: '➕ Add New Experience', value: { action: 'add' } });
        choices.push({ title: '↩️ Back to Main Menu', value: { action: 'back' } });

        const expAction = await prompts({
          type: 'select',
          name: 'choice',
          message: 'Manage experience:',
          choices
        });

        if (expAction.choice && expAction.choice.action !== 'back') {
          const isAdd = expAction.choice.action === 'add';
          const targetExp = isAdd ? { company: '', role: '', startDate: '', endDate: '', description: '' } : currentProfile.experience[expAction.choice.index];

          const edits = await prompts([
            {
              type: 'text',
              name: 'company',
              message: 'Company Name:',
              initial: targetExp.company
            },
            {
              type: 'text',
              name: 'role',
              message: 'Role/Title:',
              initial: targetExp.role
            },
            {
              type: 'text',
              name: 'startDate',
              message: 'Start Date:',
              initial: targetExp.startDate
            },
            {
              type: 'text',
              name: 'endDate',
              message: 'End Date (e.g. Present or MM/YYYY):',
              initial: targetExp.endDate
            },
            {
              type: 'text',
              name: 'description',
              message: 'Description / Bullet points:',
              initial: targetExp.description
            }
          ]);

          if (edits.company !== undefined) {
            if (isAdd) {
              currentProfile.experience.push(edits);
            } else {
              currentProfile.experience[expAction.choice.index] = edits;
            }
          }
        }
        break;
      }

      case 'education': {
        console.log('\n--- Education Editor ---');
        const choices = currentProfile.education.map((edu, idx) => ({
          title: `Edit: ${edu.degree} in ${edu.fieldOfStudy} from ${edu.school}`,
          value: { action: 'edit', index: idx }
        }));
        choices.push({ title: '➕ Add New Education', value: { action: 'add' } });
        choices.push({ title: '↩️ Back to Main Menu', value: { action: 'back' } });

        const eduAction = await prompts({
          type: 'select',
          name: 'choice',
          message: 'Manage education:',
          choices
        });

        if (eduAction.choice && eduAction.choice.action !== 'back') {
          const isAdd = eduAction.choice.action === 'add';
          const targetEdu = isAdd ? { school: '', degree: '', fieldOfStudy: '', graduationYear: '' } : currentProfile.education[eduAction.choice.index];

          const edits = await prompts([
            {
              type: 'text',
              name: 'school',
              message: 'School/University Name:',
              initial: targetEdu.school
            },
            {
              type: 'text',
              name: 'degree',
              message: 'Degree (e.g. B.S., M.S.):',
              initial: targetEdu.degree
            },
            {
              type: 'text',
              name: 'fieldOfStudy',
              message: 'Field of Study:',
              initial: targetEdu.fieldOfStudy
            },
            {
              type: 'text',
              name: 'graduationYear',
              message: 'Graduation Year:',
              initial: targetEdu.graduationYear
            }
          ]);

          if (edits.school !== undefined) {
            if (isAdd) {
              currentProfile.education.push(edits);
            } else {
              currentProfile.education[eduAction.choice.index] = edits;
            }
          }
        }
        break;
      }

      case 'target': {
        const edits = await prompts([
          {
            type: 'text',
            name: 'targetJob',
            message: 'Target Job Title:',
            initial: currentProfile.targetJob
          },
          {
            type: 'text',
            name: 'targetLocation',
            message: 'Target Search Location (e.g. Remote, City):',
            initial: currentProfile.targetLocation || 'Remote'
          }
        ]);
        if (edits.targetJob !== undefined) {
          currentProfile.targetJob = edits.targetJob;
          currentProfile.targetLocation = edits.targetLocation;
        }
        break;
      }

      case 'reupload':
        return { action: 'reupload' };

      case 'save':
        running = false;
        break;
    }
  }

  // Save to profile.json
  const savePath = path.join(process.cwd(), 'profile.json');
  fs.writeFileSync(savePath, JSON.stringify(currentProfile, null, 2));
  console.log(`\n🎉 Profile successfully confirmed and saved to ${savePath}\n`);
  return currentProfile;
}

function printProfileOverview(prof) {
  console.log(`\n👤 Name:     ${prof.name || 'Not specified'}`);
  console.log(`✉️  Email:    ${prof.email || 'Not specified'}`);
  console.log(`📞 Phone:    ${prof.phone || 'Not specified'}`);
  console.log(`📍 Location: ${prof.location || 'Not specified'}`);
  console.log(`🎯 Target Job: "${prof.targetJob || 'Not specified'}" in "${prof.targetLocation || 'Remote'}"`);
  console.log(`⚡ Skills (${prof.skills.length}): ${prof.skills.slice(0, 8).join(', ')}${prof.skills.length > 8 ? '...' : ''}`);
  console.log(`💼 Exp:      ${prof.experience.length} jobs listed`);
  console.log(`🎓 Edu:      ${prof.education.length} degrees listed`);
  console.log("=============================================\n");
}
