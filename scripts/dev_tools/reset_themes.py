#!/usr/bin/env python
"""
Reset Theme Data Script
Clear all theme profiles and schedules, then reinitialize with defaults.
"""

import sys
from app import create_app
from app.extensions import db
from app.models.theme import ThemeProfile, ThemeSchedule, ThemeRuntimeState
from app.services.theme_manager import ensure_seed_data


def reset_themes():
    """Clear all theme data and reinitialize with defaults."""
    app = create_app()
    
    with app.app_context():
        print("🔄 Resetting theme data...")
        print("-" * 50)
        
        # Count existing data
        profile_count = ThemeProfile.query.count()
        schedule_count = ThemeSchedule.query.count()
        state_count = ThemeRuntimeState.query.count()
        
        print(f"Found:")
        print(f"  • {profile_count} theme profiles")
        print(f"  • {schedule_count} theme schedules")
        print(f"  • {state_count} runtime states")
        
        # Delete all theme data (order matters due to foreign keys)
        print("\n🗑️  Deleting all theme data...")
        ThemeSchedule.query.delete()
        print("  ✓ Deleted all theme schedules")
        
        ThemeRuntimeState.query.delete()
        print("  ✓ Deleted all runtime states")
        
        ThemeProfile.query.delete()
        print("  ✓ Deleted all theme profiles")
        
        db.session.commit()
        print("\n" + "-" * 50)
        
        # Reinitialize for each scope
        scopes = ["admin", "expert", "farmer"]
        print("\n📦 Reinitializing default themes for each scope...")
        
        for scope in scopes:
            try:
                ensure_seed_data(scope=scope, actor_id=None)
                print(f"  ✓ {scope.capitalize()} scope reinitialized")
            except Exception as e:
                print(f"  ✗ Error reinitializing {scope}: {str(e)}")
                db.session.rollback()
                return 1
        
        db.session.commit()
        print("\n" + "=" * 50)
        print("✅ Theme data reset successfully!")
        print("=" * 50)
        
        # Show new data
        new_profiles = ThemeProfile.query.count()
        new_states = ThemeRuntimeState.query.count()
        
        print(f"\nNew data:")
        print(f"  • {new_profiles} theme profiles (all scopes)")
        print(f"  • {new_states} runtime states")
        
        # Show profiles by scope
        print("\nProfiles by scope:")
        for scope in scopes:
            count = ThemeProfile.query.filter_by(scope=scope).count()
            active = ThemeProfile.query.filter_by(scope=scope, is_active=True).first()
            active_label = f" (Active: {active.label})" if active else ""
            print(f"  • {scope.capitalize()}: {count} profiles{active_label}")
        
        return 0


if __name__ == "__main__":
    sys.exit(reset_themes())
