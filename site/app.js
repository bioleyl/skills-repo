const searchInput = document.querySelector('#search');
const skillsElement = document.querySelector('#skills');
const summaryElement = document.querySelector('#summary');
const errorElement = document.querySelector('#error');

let skills = [];

function createTag(keyword) {
  const tag = document.createElement('li');
  tag.className = 'tag';
  tag.textContent = keyword;
  return tag;
}

function createCard(skill) {
  const card = document.createElement('article');
  card.className = 'card';

  const heading = document.createElement('h3');
  const link = document.createElement('a');
  link.href = `https://github.com/bioleyl/skills-repo/tree/${skill.commitSha}/${skill.path}`;
  link.textContent = skill.name;
  const version = document.createElement('span');
  version.className = 'version';
  version.textContent = `v${skill.version}`;
  heading.append(link, version);

  const description = document.createElement('p');
  description.className = 'description';
  description.textContent = skill.description;

  const tags = document.createElement('ul');
  tags.className = 'tags';
  for (const keyword of skill.keywords) tags.append(createTag(keyword));

  card.append(heading, description, tags);
  return card;
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const visible = skills.filter((skill) => {
    if (!query) return true;
    return [skill.name, skill.description, ...skill.keywords].some((value) => value.toLowerCase().includes(query));
  });
  skillsElement.replaceChildren(...visible.map(createCard));
  summaryElement.textContent = `${visible.length} of ${skills.length} skill${skills.length === 1 ? '' : 's'}`;
}

async function load() {
  try {
    const response = await fetch('./skills.json');
    if (!response.ok) throw new Error(`Registry request failed (${response.status})`);
    const registry = await response.json();
    skills = registry.skills.map((skill) => ({ ...skill, commitSha: registry.commitSha }));
    render();
  } catch (error) {
    summaryElement.textContent = 'The registry could not be loaded.';
    errorElement.hidden = false;
    errorElement.textContent = error instanceof Error ? error.message : String(error);
  }
}

searchInput.addEventListener('input', render);
load();
