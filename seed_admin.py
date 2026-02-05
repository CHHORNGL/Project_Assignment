# seed_admin.py

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
    # CREATE ADMIN USER
    # ===============================
    admin_user = User.query.filter_by(username="admin").first()

    if not admin_user:
        admin_user = User(username="admin")
        admin_user.set_password("admin123")  # ✅ CORRECT WAY
        admin_user.roles.append(admin_role)

        db.session.add(admin_user)
        db.session.commit()

        print("🎉 Admin user created successfully")
        print("👉 Username: admin")
        print("👉 Password: admin123")
    else:
        print("ℹ️ Admin user already exists")
