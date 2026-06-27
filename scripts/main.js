// Full replacement of main.js — initialise UI, parse resume_faangpath.tex and render into Creative CV layout

// Initialise AOS
$(document).ready(function() {
  AOS.init({
    // once: true
  });
});

// Smooth scroll for links with hashes
$('a.smooth-scroll').click(function(event) {
  if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') &&
      location.hostname == this.hostname) {
    var target = $(this.hash);
    target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
    if (target.length) {
      event.preventDefault();
      $('html, body').animate({
        scrollTop: target.offset().top
      }, 1000, function() {
        var $target = $(target);
        $target.focus();
        if ($target.is(":focus")) {
          return false;
        } else {
          $target.attr('tabindex','-1');
          $target.focus();
        }
      });
    }
  }
});

// ----------------------
// Resume parser & render
// ----------------------

function escapeHtml(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Try multiple resume paths, fall back to upload UI
async function loadTexResume(candidates = ['/resume_faangpath.tex','/resume_faangpath.TEX','/RESUME_FAANGPATH.TEX','/resume.tex','/RESUME.tex']) {
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const tex = await res.text();
        const resume = parseTexResume(tex);
        renderParsedResume(resume);
        return;
      }
    } catch (e) {
      // continue
    }
  }

  // fallback: show upload control in about area
  const aboutNode = document.getElementById('about-content') || document.querySelector('#about .card .card-body');
  if (!aboutNode) return;
  aboutNode.innerHTML = `
    <h3>Resume file not found</h3>
    <p>Place <code>resume_faangpath.tex</code> at site root or upload a .tex file:</p>
    <input id="texUpload" type="file" accept=".tex,text/plain"/>
    <div style="margin-top:8px;color:#666;font-size:.95em">Upload is client-side only.</div>
  `;
  const input = document.getElementById('texUpload');
  if (input) {
    input.addEventListener('change', (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const resume = parseTexResume(e.target.result);
          renderParsedResume(resume);
        } catch (err) {
          console.error('Error parsing uploaded tex', err);
          alert('Failed to parse uploaded .tex file.');
        }
      };
      reader.readAsText(file);
    });
  }
}

// Parse expected macros and sections
function parseTexResume(tex) {
  
  const single = (name) => {
    const re = new RegExp('\\\\' + name + '\\{([^}]*)\\}', 'g');
    const m = re.exec(tex);
    return m ? m[1].trim() : '';
  };
  const getName = () => {
    const m = /\\setname\{([^}]*)\}\{([^}]*)\}/.exec(tex);
    return m ? m[1].trim() : single('setname');
  };

  // 1. Strip loose numbers, percentages, and empty LaTeX comments
let cleanedTex = String(tex)

  // remove percent noise
  .replace(/^\s*\d+%\s*$/gm, '')
  .replace(/^\s*%\s*$/gm, '')

  // remove macro definitions
  .replace(/\\newcommand\s*\{\\[^}]+\}\s*\{[\s\S]*?\}/g, '')

  // REMOVE ALL skill macro USAGE (IMPORTANT)
  .replace(/\\createskills?\{[\s\S]*?\}/g, '')

  // REMOVE spacing / layout commands
  .replace(/\\vspace\{[^}]*\}/g, '')
  .replace(/\\smallskip/g, '')
  .replace(/\\bigskip/g, '')

  // remove document boilerplate
  .replace(/\\documentclass[\s\S]*?\\begin\{document\}/g, '')
  .replace(/\\usepackage[\s\S]*?\n/g, '')
  .replace(/\\begin\{document\}/g, '')
  .replace(/\\end\{document\}/g, '')

  // normalize skill separators BEFORE parsing
  .replace(/\\cpshalf/g, ' | ')
  .replace(/\\cps/g, ' | ')
  .replace(/\\coloredbullet/g, '__BULLET__')

  // remove formatting macros
  .replace(/\\textbf\{([^}]*)\}/g, '$1')
  .replace(/\\emph\{([^}]*)\}/g, '$1')

  // cleanup leftover empty braces
  .replace(/\{\s*\}/g, '')
  .replace(/\}\s*\}/g, '}')

  .replace(/\r/g, '\n');
  let normalized = cleanedTex

  const resume = {
    name: getName(),
    address: single('setaddress'),
    mobile: single('setmobile'),
    email: single('setmail'),
    linkedin: single('setlinkedinaccount'),
    github: single('setgithubaccount'),
    site: single('setsiteurl'),
    themeColor: single('setthemecolor'),
    summary: '',
    sections: {}
  };

  const sectionRe =
  /\\section\s*\{([^}]*)\}([\s\S]*?)(?=(\\section\s*\{|\\end\{document\}|$))/g;
  let s;
  while ((s = sectionRe.exec(normalized)) !== null) {
    const title = s[1].trim();
    const body = s[2].trim();

    const items = [];
    const dateRe = /\\datedexperience\{([^}]*)\}\{([^}]*)\}([\s\S]*?)(?=(\\datedexperience\{|\\section\{|$))/g;
    let d;
    while ((d = dateRe.exec(body)) !== null) {
      const heading = d[1].trim();
      const dates = d[2].trim();
      const after = d[3] || '';

      const ex = /\\explanation\{([^}]*)\}\{([^}]*)\}/.exec(after);
      const role = ex ? ex[1].trim() : '';
      const location = ex ? ex[2].trim() : '';

      const det = /\\explanationdetail\{([\s\S]*?)\}/.exec(after);
      const detail = det
      ? det[1]
          .replace(/__BULLET__/g, "\n__BULLET__")
          .replace(/\\coloredbullet/g, "__BULLET__")
          .replace(/\\newline/g, "\n")
          .replace(/\\bigskip/g, "\n")
          .replace(/\\smallskip/g, "\n")
          .replace(/\\textbf\{([^}]*)\}/g, "$1")
          .replace(/\\emph\{([^}]*)\}/g, "$1")
          .replace(/\\%/g, "%")
          .replace(/%/g, "")
          .replace(/\\/g, "")
          .trim()
      : "";
      //console.log('detail', detail);
      items.push({ heading, dates, role, location, detail });
    }

    if (items.length)
    { 
        resume.sections[title] = { type: 'experience', items };
    }
    else 
    {
      let cleanedBody = body
        .replace(/^%.*$/gm, '')
        .replace(/\\newline/g, '<br>')
        .replace(/\\smallskip/g, '<br>')
        .replace(/\\bigskip/g, '<br><br>')
        .replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>')
        .replace(/\\emph\{([^}]*)\}/g, '$1')
        .replace(/\\explanation\{([^}]*)\}\{[^}]*\}/g, '<h6>$1</h6>')
        .replace(
          /\\explanationdetail\{([\s\S]*?)\}/g,
          (match, content) => {

            const bullets = content
              .split('__BULLET__')
              .map(x =>
                x
                  .replace(/\\\s*%/g, '')
                  .replace(/%/g, '')
                  .replace(/\\/g, '')
                  .trim()
              )
              .filter(Boolean);

            return `
              <ul>
                ${bullets.map(b => `<li>${b}</li>`).join('')}
              </ul>
            `;
          }
        )
        .trim();
      resume.sections[title] = {
        type: 'text',
        content: cleanedBody
      };
    }
  }

  resume.summary = resume.sections['Summary'] ? resume.sections['Summary'].content : '';
  return resume;
}

// Render parsed resume into existing Creative CV DOM (no new sections created)
function renderParsedResume(r) {
  const esc = s => escapeHtml(s || '');

  // HERO / NAME
  const nameEl = document.querySelector('.h2.title') || document.querySelector('.title');
  if (nameEl && r.name) nameEl.textContent = r.name;

  // SHORT CATEGORY (first 120 chars of summary)
  const categoryEl = document.querySelector('.category.text-white');
  if (categoryEl && r.summary) categoryEl.textContent = r.summary.replace(/\n/g,' ').substring(0,120);

  // ABOUT: #about-content if present
  const aboutContentEl = document.getElementById('about-content');
  if (aboutContentEl) {
    const summary = r.summary || '';
    aboutContentEl.innerHTML =
  summary
    ? summary
    : '<p>No summary provided. Add \\section{Summary} to your .tex file.</p>';
  } else {
    const aboutCard = document.querySelector('#about .card .card-body');
    if (aboutCard) {
      const summary = r.summary || '';
      const p = aboutCard.querySelector('p') || aboutCard;
      p.innerHTML =
  summary
    ? summary
    : p.innerHTML;
    }
  }

  // BASIC INFO: update right-hand info card in About section
  // find the card-body that contains Basic Information rows
  let infoCard = document.querySelector('#about .card .row > .col-lg-6:nth-child(2) .card-body');
  if (!infoCard) {
    // fallback to contact card area
    infoCard = document.querySelector('.cc-contact .card-body') || document.querySelector('#contact .card .card-body');
  }
  if (infoCard) {
    if (r.address) updateField(infoCard, 'Address', '');
    if (r.mobile) updateField(infoCard, 'Phone', '');
    if (r.email) updateField(infoCard, 'Email', `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>`, true);
    if (r.linkedin) updateField(infoCard, 'Lin"kedIn', `<a target="_blank" href="${esc(r.linkedin)}">${esc(r.linkedin)}</a>`, true);
    if (r.github) updateField(infoCard, 'GitHub', `<a target="_blank" href="${esc(r.github)}">${esc(r.github)}</a>`, true);
    if (r.site) updateField(infoCard, 'Website', `<a target="_blank" href="${esc(r.site)}">${esc(r.site)}</a>`, true);
  }

  // AGE CALCULATOR (FIXED VALUE)
  const birthYear = 1986;
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;

  const ageDisplay = document.getElementById('ageDisplay');
  if (ageDisplay) {
    ageDisplay.innerText = age;
  }

  //Render Card
  function renderCards(section, items, headerClass, renderBody) {
    if (!section || !items?.length) return;

    const title = section.querySelector('.title');
    const template = section.querySelector('.card');
    if (!template) return;

    section.querySelectorAll('.card').forEach(c => c.remove());

    items.forEach(item => {
        const card = template.cloneNode(true);

        // Left side
        const header = card.querySelector(headerClass);
        if (header) {
            const h5 = header.querySelector('.h5');
            const p = header.querySelector('p');

            if (h5) h5.textContent = item.heading || "";
            if (p) p.textContent = item.dates || "";
        }

        // Right side
        const body = card.querySelector('.col-md-9 .card-body');
        if (body) body.innerHTML = renderBody(item);

        section.appendChild(card);
    });

    if (title) section.prepend(title);
  }
  // EXPERIENCE
    renderCards(
      document.querySelector('.cc-experience'),
      r.sections["Experience"]?.items,
      '.cc-experience-header',
      exp => {
          const bullets = (exp.detail || "")
              .split("__BULLET__")
              .map(x => x.trim())
              .filter(Boolean);

          return `
              <div class="h5">${esc(exp.role || "")}</div>
              ${exp.location ? `<div class="text-muted mb-2">${esc(exp.location)}</div>` : ""}
              <ul>${bullets.map(b => `<li>${esc(b)}</li>`).join("")}</ul>
          `;
      }
  );

  // EDUCATION
  renderCards(
    document.querySelector('.cc-education'),
    (r.sections["Education"] || r.sections["Education And Certification"])?.items,
    '.cc-education-header',
    edu => `
        <div class="h5">${esc(edu.role || "")}</div>
        ${edu.location ? `<div class="text-muted mb-2">${esc(edu.location)}</div>` : ""}
        <p>${esc(edu.detail || "").replace(/\n/g, "<br>")}</p>
    `
  );

  // SKILLS
  const skillsSection = document.querySelector('#skill .card .card-body') || document.querySelector('.cc-skills .card-body') || document.querySelector('.cc-skills');
  const skillsText = r.sections['Skills'] ? r.sections['Skills'].content : '';
  if (skillsSection && skillsText) {
    const skills = skillsText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const rows = skillsSection.querySelectorAll('.progress-container');
    if (rows.length) {
      skills.forEach((skill, i) => {
        if (i >= rows.length) return;
        const badge = rows[i].querySelector('.progress-badge');
        if (badge) badge.textContent = skill;
      });
    } else {
      skillsSection.innerHTML = `<pre class="skills-pre">${esc(skillsText)}</pre>`;
    }
  }

  // PROJECTS / PORTFOLIO
  const projectSection = document.querySelector('#portfolio .tab-content') || document.querySelector('#portfolio .gallery');
  const projectData = r.sections['Projects'];
  if (projectSection && projectData) {
    projectSection.innerHTML = `<div class="card-body">${esc(projectData.content || '').replace(/\n/g,'<br>')}</div>`;
  }

  // CONTACT
  const contactCard = document.querySelector('#contact .card .row .col-md-6:last-child .card-body') || document.querySelector('.cc-contact .card-body');
  if (contactCard) {
    contactCard.innerHTML = `
      <p class="mb-0"><strong>Email</strong></p>
      <p>${r.email ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : ''}</p>
      <p class="mb-0"><strong>Links</strong></p>
      <p>${r.linkedin ? `<a href="${esc(r.linkedin)}" target="_blank">LinkedIn</a>` : ''} ${r.github ? ' | <a href="'+esc(r.github)+'" target="_blank">GitHub</a>' : ''} ${r.site ? ' | <a href="'+esc(r.site)+'" target="_blank">Website</a>' : ''}</p>
    `;
  }
}

// Helper: update labeled row inside a card-body that uses col-sm-4 / col-sm-8 pattern
function updateField(container, label, value, html=false) {
  const rows = container.querySelectorAll('.row');
  rows.forEach(row => {
    const key = row.querySelector('.col-sm-4');
    const val = row.querySelector('.col-sm-8');
    if (key && val && key.textContent && key.textContent.trim().toLowerCase().includes(label.toLowerCase())) {
      if (html) val.innerHTML = value;
      else val.textContent = value;
    }
  });
}

// Optional: createSection kept but not used by renderer
function createSection(id) {
  const el = document.createElement('section');
  el.id = id;
  el.className = 'resume-section';
  const main = document.getElementById('siteContent') || document.body;
  main.appendChild(el);
  return el;
}

// Blog helpers (optional)
function saveBlogPost() {
  const raw = (document.getElementById('blogEditor') && document.getElementById('blogEditor').value) || '';
  const trimmed = raw.trim();
  if (!trimmed) return;
  const lines = trimmed.split('\n');
  const title = lines.shift().trim() || 'Untitled';
  const body = lines.join('\n').trim();
  const posts = JSON.parse(localStorage.getItem('myBlogPosts') || '[]');
  posts.unshift({ id: Date.now(), title, body, createdAt: new Date().toISOString() });
  localStorage.setItem('myBlogPosts', JSON.stringify(posts));
  loadBlogPosts();
  if (document.getElementById('blogEditor')) document.getElementById('blogEditor').value = '';
}
function loadBlogPosts() {
  const posts = JSON.parse(localStorage.getItem('myBlogPosts') || '[]');
  const el = document.getElementById('postsList');
  if (!el) return;
  el.innerHTML = posts.map(p => `<article class="post"><h3>${escapeHtml(p.title)}</h3><small>${new Date(p.createdAt).toLocaleString()}</small><p>${escapeHtml(p.body).replace(/\n/g,'<br/>')}</p></article>`).join('');
}
function clearAllPosts() {
  if (!confirm('Delete all blog posts?')) return;
  localStorage.removeItem('myBlogPosts');
  loadBlogPosts();
}

// UI wiring
document.addEventListener('DOMContentLoaded', () => {
  // nav-main links handling (if present)
  document.querySelectorAll('.nav-main a[data-target]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = a.getAttribute('data-target');
      document.querySelectorAll('.resume-section').forEach(s => s.style.display = 'none');
      const el = document.getElementById(target);
      if (el) el.style.display = 'block';
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const saveBtn = document.getElementById('saveBlogBtn'); if (saveBtn) saveBtn.addEventListener('click', saveBlogPost);
  const clearBtn = document.getElementById('clearBlogBtn'); if (clearBtn) clearBtn.addEventListener('click', () => { if (document.getElementById('blogEditor')) document.getElementById('blogEditor').value = ''; });
  const clearAllBtn = document.getElementById('clearAllPostsBtn'); if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllPosts);
  const blogTab = document.getElementById('blogTab'); if (blogTab) blogTab.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.resume-section').forEach(s => s.style.display = 'none');
    const el = document.getElementById('blog');
    if (el) el.style.display = 'block';
    loadBlogPosts();
  });

  // attempt to load resume
  loadTexResume(['/resume_faangpath.tex','/resume_faangpath.TEX','/RESUME_FAANGPATH.TEX','/resume.tex','/RESUME.tex']);
});