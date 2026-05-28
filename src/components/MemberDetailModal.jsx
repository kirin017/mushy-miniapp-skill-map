import React, { useEffect } from 'react';
import SkillStatusBadge from './SkillStatusBadge.jsx';
import { displayNameForMember, groupMemberSkills } from '../lib/skill-map-utils.js';

export default function MemberDetailModal({
  currentUserId,
  isCurrentUserAdmin,
  member,
  memberSkills = [],
  onClose,
  onEndorse,
  onRemoveEndorsement,
}) {
  const grouped = groupMemberSkills(memberSkills);
  const memberName = displayNameForMember(member);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose?.();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="modal-card member-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="member-modal__header">
          <div className="avatar avatar--large" aria-hidden="true">{initials(memberName)}</div>
          <div>
            <h3 id="member-detail-title">{memberName}</h3>
            <p>{member?.role || 'member'}{member?.work_phone ? ` · ${member.work_phone}` : ''}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Đóng">×</button>
        </div>

        {grouped.length === 0 ? (
          <p className="empty-copy">Chưa có skill nào được khai báo.</p>
        ) : grouped.map((group) => (
          <section key={group.group.id} className="detail-group" aria-labelledby={`member-skill-group-${group.group.id}`}>
            <h4 id={`member-skill-group-${group.group.id}`}>{group.group.name}</h4>
            {group.items.map((item) => {
              const endorsements = item.endorsements || [];
              const ownEndorsement = endorsements.find((endorsement) => endorsement.endorser_user_id === currentUserId);
              const canEndorse = item.user_id !== currentUserId;
              const adminEndorsed = endorsements.some((endorsement) => endorsement.source_type === 'admin');

              return (
                <div className="detail-skill" key={item.id}>
                  <div>
                    <div className="detail-skill__name">{item.skill?.name || 'Unknown skill'}</div>
                    <div className="detail-skill__meta">
                      <SkillStatusBadge status={item.status} />
                      {ownEndorsement && <span>Bạn đã endorse</span>}
                      {adminEndorsed && <span>Đã được admin xác nhận</span>}
                    </div>
                  </div>
                  <div className="detail-skill__actions">
                    {canEndorse && ownEndorsement && (
                      <button className="mushy-btn mushy-btn--ghost" type="button" onClick={() => onRemoveEndorsement?.(ownEndorsement)}>
                        Bỏ endorse
                      </button>
                    )}
                    {canEndorse && !ownEndorsement && (
                      <button className="mushy-btn mushy-btn--primary" type="button" onClick={() => onEndorse?.(item)}>
                        Endorse
                      </button>
                    )}
                    {isCurrentUserAdmin && endorsements
                      .filter((endorsement) => endorsement.endorser_user_id !== currentUserId)
                      .map((endorsement) => (
                        <button
                          className="text-danger"
                          key={endorsement.id}
                          type="button"
                          onClick={() => onRemoveEndorsement?.(endorsement)}
                        >
                          Gỡ {endorsement.source_type}
                        </button>
                      ))}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}
