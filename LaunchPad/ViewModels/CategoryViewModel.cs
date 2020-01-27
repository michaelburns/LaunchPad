using LaunchPad.Models;
using Microsoft.AspNetCore.Mvc.Rendering;
using System.Collections.Generic;


namespace LaunchPad.ViewModels
{
    public class CategoryViewModel
    {
        public Category Category { get; set; }
        public IEnumerable<int> SelectedRoles { get; set; }
        public SelectList AvailableRoles { get; set; }
    }
}
