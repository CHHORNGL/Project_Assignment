from datetime import datetime

from app.extensions import db


class ThemeProfile(db.Model):
    __tablename__ = "theme_profiles"

    id = db.Column(db.Integer, primary_key=True)
    scope = db.Column(db.String(32), nullable=False, index=True, default="admin")
    slug = db.Column(db.String(80), nullable=False)
    label = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    tokens_json = db.Column(db.Text, nullable=False, default="{}")
    is_active = db.Column(db.Boolean, nullable=False, default=False, index=True)
    is_locked = db.Column(db.Boolean, nullable=False, default=False)
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        index=True,
    )

    __table_args__ = (
        db.UniqueConstraint("scope", "slug", name="uq_theme_profiles_scope_slug"),
    )

    schedules = db.relationship(
        "ThemeSchedule",
        back_populates="profile",
        cascade="all,delete-orphan",
        lazy="dynamic",
    )

    def __repr__(self):
        return f"<ThemeProfile scope={self.scope} slug={self.slug} active={self.is_active}>"


class ThemeRuntimeState(db.Model):
    __tablename__ = "theme_runtime_states"

    scope = db.Column(db.String(32), primary_key=True)
    active_profile_id = db.Column(db.Integer, db.ForeignKey("theme_profiles.id"), nullable=True, index=True)
    revision = db.Column(db.Integer, nullable=False, default=1)
    auto_schedule_enabled = db.Column(db.Boolean, nullable=False, default=True)
    cache_ttl_seconds = db.Column(db.Integer, nullable=False, default=120)
    radius_mode = db.Column(db.String(16), nullable=False, default="soft")
    density_mode = db.Column(db.String(16), nullable=False, default="comfortable")
    updated_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        index=True,
    )

    active_profile = db.relationship("ThemeProfile", foreign_keys=[active_profile_id], lazy="joined")

    def __repr__(self):
        return (
            f"<ThemeRuntimeState scope={self.scope} rev={self.revision} "
            f"profile_id={self.active_profile_id}>"
        )


class ThemeSchedule(db.Model):
    __tablename__ = "theme_schedules"

    id = db.Column(db.Integer, primary_key=True)
    scope = db.Column(db.String(32), nullable=False, index=True, default="admin")
    name = db.Column(db.String(120), nullable=False)
    profile_id = db.Column(db.Integer, db.ForeignKey("theme_profiles.id"), nullable=False, index=True)
    timezone = db.Column(db.String(64), nullable=False, default="UTC")
    weekdays_json = db.Column(db.String(64), nullable=True)  # JSON array, e.g. [0,1,2,3,4]
    start_time = db.Column(db.String(5), nullable=True)  # HH:MM
    end_time = db.Column(db.String(5), nullable=True)  # HH:MM
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    priority = db.Column(db.Integer, nullable=False, default=100, index=True)
    is_enabled = db.Column(db.Boolean, nullable=False, default=True, index=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        index=True,
    )

    profile = db.relationship("ThemeProfile", back_populates="schedules", lazy="joined")

    def __repr__(self):
        return (
            f"<ThemeSchedule scope={self.scope} profile_id={self.profile_id} "
            f"enabled={self.is_enabled} priority={self.priority}>"
        )
