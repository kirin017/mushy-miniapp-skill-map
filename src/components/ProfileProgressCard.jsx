import React from 'react';

export default function ProfileProgressCard({ progress, saving = false, onAddSkill }) {
  if (!progress) return null;

  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const items = progress.items || [];
  const suggestions = progress.suggestions || [];

  return (
    <section className="mushy-card profile-progress" aria-labelledby="profile-progress-title">
      <div className="profile-progress__head">
        <div className="profile-progress__copy">
          <h2 id="profile-progress-title">Hoàn thiện skill profile</h2>
          <p>Một profile đủ rõ giúp team biết khi nào nên hỏi bạn và mentor thấy nhóm đang thiếu gì.</p>
        </div>
        <span className="profile-progress__label">
          {progress.completed}/{progress.total} bước
        </span>
      </div>

      <div
        className="profile-progress__bar"
        role="progressbar"
        aria-label="Tiến độ hoàn thiện skill profile"
        aria-valuemin="0"
        aria-valuemax={progress.total}
        aria-valuenow={progress.completed}
        aria-valuetext={`${progress.completed}/${progress.total} bước`}
      >
        <span style={{ width: `${percent}%` }} />
      </div>

      <ul className="profile-progress__checklist" aria-label="Các bước hoàn thiện skill profile">
        {items.map((item) => (
          <li
            className={`profile-progress__item${item.done ? ' profile-progress__item--done' : ''}`}
            key={item.id}
            aria-label={`${item.label}: ${item.done ? 'đã xong' : 'chưa xong'}`}
          >
            <span className="profile-progress__check" aria-hidden="true" />
            {item.label}
          </li>
        ))}
      </ul>

      {suggestions.length > 0 ? (
        <div className="profile-progress__actions" aria-label="Gợi ý skill để thêm nhanh">
          {suggestions.map((skill) => (
            <button
              className="quick-skill"
              disabled={saving}
              key={skill.id}
              type="button"
              onClick={() => onAddSkill?.(skill)}
            >
              Thêm {skill.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="profile-progress__empty">Bạn đã thêm hết skill gợi ý hiện có.</p>
      )}
    </section>
  );
}
