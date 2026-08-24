# seed_admin.py
import os
from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission

app = create_app()

with app.app_context():

    # ===============================
    # CREATE ADMIN ROLE
    # ===============================
    admin_role = Role.query.filter_by(name="admin").first()
    if not admin_role:
        admin_role = Role(name="admin")
        db.session.add(admin_role)
        db.session.commit()
        print("✅ Role 'admin' created")

    # ===============================
    # CREATE PERMISSIONS
    # ===============================
    permissions = [
        "view_dashboard",
        "view_reports",
        "manage_users",
        "manage_roles",
        "manage_crops"
    ]

    for perm_code in permissions:
        perm = Permission.query.filter_by(code=perm_code).first()
        if not perm:
            perm = Permission(code=perm_code, name=perm_code.replace("_", " ").title())
            db.session.add(perm)
            db.session.commit()
            print(f"✅ Permission '{perm_code}' created")

        if perm not in admin_role.permissions:
            admin_role.permissions.append(perm)
            db.session.commit()
            print(f"🔗 Permission '{perm_code}' assigned to admin role")

    # ===============================
    # CREATE/UPDATE ADMIN USER
    # ===============================
    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL")
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

    if not ADMIN_EMAIL:
        raise RuntimeError("ADMIN_EMAIL is not configured")

    if not ADMIN_PASSWORD:
        raise RuntimeError("ADMIN_PASSWORD is not configured")

    admin_user = User.query.filter_by(email=ADMIN_EMAIL).first()
    if not admin_user:
        admin_user = User.query.filter_by(username="admin").first()

    email_taken = User.query.filter_by(email=ADMIN_EMAIL).first()

    target_email = ADMIN_EMAIL
    if email_taken and admin_user and admin_user.id != email_taken.id:
        if not admin_user.email:
            target_email = "backup_admin@agrisystem.com"
        else:
            target_email = admin_user.email

    if not admin_user:
        final_email = "backup_admin@agrisystem.com" if email_taken else ADMIN_EMAIL
        admin_user = User(username="admin", email=final_email, is_verified=True)
        admin_user.set_password(ADMIN_PASSWORD)
        admin_user.roles.append(admin_role)
        db.session.add(admin_user)
        db.session.commit()
        print("🎉 Admin user created successfully")
        print(f"👉 Email: {final_email}")
    else:
        if not admin_user.email or admin_user.email != target_email:
            admin_user.email = target_email
        admin_user.is_verified = True
        admin_user.is_active = True
        if admin_role not in admin_user.roles:
            admin_user.roles.append(admin_role)
        db.session.commit()
        print("🎉 Admin user updated successfully")
        print(f"👉 Email: {admin_user.email}")
