"""Add payment transactions and premium coupons tables.

Revision ID: c7d8e9f0a1b2
Revises: 62a8b52946e4
Create Date: 2026-10-06 02:15:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c7d8e9f0a1b2'
down_revision = '62a8b52946e4'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    insp = sa.inspect(conn)
    existing_tables = set(insp.get_table_names())

    # Create premium_coupons table if it doesn't already exist
    if 'premium_coupons' not in existing_tables:
        op.create_table(
            'premium_coupons',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('code', sa.String(length=50), nullable=False),
            sa.Column('discount_type', sa.String(length=20), nullable=False, server_default='percent'),
            sa.Column('discount_value', sa.Float(), nullable=False, server_default='10.0'),
            sa.Column('max_uses', sa.Integer(), nullable=False, server_default='100'),
            sa.Column('times_used', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
            sa.Column('expires_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.text('CURRENT_TIMESTAMP')),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('premium_coupons', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_premium_coupons_code'), ['code'], unique=True)

    # Create payment_transactions table if it doesn't already exist
    if 'payment_transactions' not in existing_tables:
        op.create_table(
            'payment_transactions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('payment_method', sa.String(length=32), nullable=False, server_default='BAKONG_KHQR'),
            sa.Column('bill_number', sa.String(length=64), nullable=False),
            sa.Column('md5', sa.String(length=64), nullable=True),
            sa.Column('qr_string', sa.Text(), nullable=True),
            sa.Column('deeplink', sa.Text(), nullable=True),
            sa.Column('amount', sa.Float(), nullable=False, server_default='0.0'),
            sa.Column('currency', sa.String(length=10), nullable=False, server_default='USD'),
            sa.Column('billing_interval', sa.String(length=20), nullable=False, server_default='monthly'),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='PENDING'),
            sa.Column('coupon_code', sa.String(length=50), nullable=True),
            sa.Column('account_id', sa.String(length=128), nullable=True),
            sa.Column('metadata_json', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
            sa.Column('paid_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('payment_transactions', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_payment_transactions_user_id'), ['user_id'], unique=False)
            batch_op.create_index(batch_op.f('ix_payment_transactions_bill_number'), ['bill_number'], unique=False)
            batch_op.create_index(batch_op.f('ix_payment_transactions_md5'), ['md5'], unique=True)
            batch_op.create_index(batch_op.f('ix_payment_transactions_status'), ['status'], unique=False)


def downgrade():
    conn = op.get_bind()
    insp = sa.inspect(conn)
    existing_tables = set(insp.get_table_names())

    if 'payment_transactions' in existing_tables:
        with op.batch_alter_table('payment_transactions', schema=None) as batch_op:
            batch_op.drop_index(batch_op.f('ix_payment_transactions_status'))
            batch_op.drop_index(batch_op.f('ix_payment_transactions_md5'))
            batch_op.drop_index(batch_op.f('ix_payment_transactions_bill_number'))
            batch_op.drop_index(batch_op.f('ix_payment_transactions_user_id'))
        op.drop_table('payment_transactions')

    if 'premium_coupons' in existing_tables:
        with op.batch_alter_table('premium_coupons', schema=None) as batch_op:
            batch_op.drop_index(batch_op.f('ix_premium_coupons_code'))
        op.drop_table('premium_coupons')
