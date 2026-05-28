import React, { useEffect, useMemo, useState } from 'react';
import Select from './Select.jsx';
import { normalizeSkillName } from '../lib/skill-map-utils.js';

const statusOptions = [
  { value: 'usable', label: 'Dùng được' },
  { value: 'learning', label: 'Đang học' },
];

export default function SkillTypeahead({ groups = [], skills = [], disabled = false, onSubmit }) {
  const [groupId, setGroupId] = useState(groups[0]?.id || '');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('usable');

  useEffect(() => {
    const groupExists = groups.some((group) => group.id === groupId);
    if ((!groupId || !groupExists) && groups[0]?.id) {
      setGroupId(groups[0].id);
    }
  }, [groupId, groups]);

  const groupOptions = useMemo(
    () => groups.map((group) => ({ value: group.id, label: group.name })),
    [groups]
  );

  const normalizedName = normalizeSkillName(name);

  const suggestions = useMemo(() => {
    if (!normalizedName) return [];

    return skills
      .filter((skill) => skill.group_id === groupId)
      .filter((skill) => normalizeSkillName(skill.normalized_name || skill.name).includes(normalizedName))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      .slice(0, 6);
  }, [groupId, normalizedName, skills]);

  const exactMatch = skills
    .filter((skill) => skill.group_id === groupId)
    .find((skill) => normalizeSkillName(skill.normalized_name || skill.name) === normalizedName);
  const canSubmit = !disabled && Boolean(groupId) && Boolean(name.trim());

  async function submit(event) {
    event.preventDefault();

    const cleanName = name.trim().replace(/\s+/g, ' ');
    if (!groupId || !cleanName) return;

    await onSubmit?.({ groupId, name: cleanName, status });
    setName('');
    setStatus('usable');
  }

  return (
    <form className="skill-form" onSubmit={submit}>
      <div className="skill-form__grid">
        <div>
          <label className="mushy-label">Nhóm</label>
          <Select
            value={groupId}
            onChange={setGroupId}
            options={groupOptions}
            disabled={disabled || groupOptions.length === 0}
            placeholder="Chọn nhóm"
          />
        </div>
        <div>
          <label className="mushy-label">Trạng thái</label>
          <Select value={status} onChange={setStatus} options={statusOptions} disabled={disabled} />
        </div>
      </div>

      <label className="mushy-label" htmlFor="skill-typeahead-name">Skill</label>
      <input
        id="skill-typeahead-name"
        className="mushy-input"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={disabled}
        placeholder="Nhập skill hoặc chọn gợi ý"
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={suggestions.length > 0 ? 'skill-typeahead-suggestions' : undefined}
      />

      {suggestions.length > 0 && (
        <div className="skill-suggestions" id="skill-typeahead-suggestions" role="listbox" aria-label="Skill gợi ý">
          {suggestions.map((skill) => (
            <button
              key={skill.id}
              type="button"
              role="option"
              aria-selected={normalizeSkillName(skill.name) === normalizedName}
              onClick={() => setName(skill.name)}
              disabled={disabled}
            >
              {skill.name}
            </button>
          ))}
        </div>
      )}

      <button className="mushy-btn mushy-btn--primary mushy-btn--block" type="submit" disabled={!canSubmit}>
        {exactMatch ? 'Thêm skill' : 'Tạo skill và thêm'}
      </button>
    </form>
  );
}
