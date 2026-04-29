using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LaunchPad.Migrations
{
    /// <inheritdoc />
    public partial class AddJobArgs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Args",
                table: "Jobs",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Args",
                table: "Jobs");
        }
    }
}
